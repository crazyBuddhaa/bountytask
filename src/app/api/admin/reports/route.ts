import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAdminRole, parseBoolSetting } from "@/lib/security"

export const dynamic = 'force-dynamic'

function periodToDays(period: string): number {
  return period === "7d" ? 7 : period === "90d" ? 90 : 30
}

type ProviderStatus = "active" | "needs_config" | "disabled"

interface ProviderHealthRow {
  id: string
  name: string
  enabled: boolean
  configured: boolean
  status: ProviderStatus
  completions: number
  payout_kobo: number
  note: string
}

const PROVIDER_SETTING_KEYS = [
  "ima_enabled",
  "ima_ad_tag_url",
  "cpx_enabled",
  "cpx_app_id",
  "cpx_secure_hash_key",
  "cpx_user_share_percent",
  "asterra_enabled",
  "asterra_smartlink_url",
  "monetag_enabled",
  "monetag_multitag_script",
  "news_enabled",
  "news_earn_enabled",
] as const

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!(await getActiveAdminRole(user.id)).isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "30d"
  const days = periodToDays(period)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const admin = createAdminClient()

  const [
    usersResult,
    completionsResult,
    ledgerResult,
    topTasksResult,
    withdrawalsResult,
    adLogsResult,
    paystackRefsResult,
    paidSubmissionsResult,
    gamePoolsResult,
    settingsResult,
  ] = await Promise.all([
    admin.from("users").select("created_at").gte("created_at", since).order("created_at"),
    admin.from("task_completions").select("created_at, status").gte("created_at", since),
    admin.from("ledger").select("created_at, delta, type, ref_type").gte("created_at", since).eq("type", "credit"),
    admin.from("task_completions")
      .select("task_id, task:tasks(title)", { count: "exact" })
      .eq("status", "approved")
      .gte("created_at", since),
    admin.from("withdrawals").select("amount, status"),
    admin.from("ad_task_logs").select("provider, reward_kobo").gte("created_at", since),
    admin.from("paystack_consumed_references").select("reference, purpose, amount_kobo").gte("created_at", since),
    admin.from("task_submissions").select("budget_kobo, payment_reference").eq("payment_status", "paid").gte("created_at", since),
    admin.from("game_prize_pools").select("platform_cut_kobo").gte("created_at", since),
    admin.from("platform_settings").select("key, value").in("key", [...PROVIDER_SETTING_KEYS]),
  ])

  // Group by date
  const groupByDate = (rows: { created_at: string }[]) => {
    const map: Record<string, number> = {}
    rows.forEach(r => {
      const d = r.created_at.slice(0, 10)
      map[d] = (map[d] ?? 0) + 1
    })
    return Object.entries(map).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
  }

  const daily_signups = groupByDate(usersResult.data ?? [])
  const daily_completions = groupByDate(completionsResult.data ?? [])

  // Daily credits & credit breakdown by ref_type
  const creditMap: Record<string, number> = {}
  let task_rewards_kobo = 0
  let news_rewards_kobo = 0
  let newsReadCompletions = 0
  let game_prizes_kobo = 0
  let signup_bonuses_kobo = 0
  let referral_bonuses_kobo = 0
  let other_credits_kobo = 0
  let total_credits_kobo = 0

  ;(ledgerResult.data ?? []).forEach(e => {
    const amount = Number(e.delta ?? 0)
    const d = e.created_at.slice(0, 10)
    creditMap[d] = (creditMap[d] ?? 0) + amount
    total_credits_kobo += amount

    switch (e.ref_type) {
      case "task_reward":
        task_rewards_kobo += amount
        break
      case "news_read_reward":
        news_rewards_kobo += amount
        newsReadCompletions += 1
        break
      case "game_prize":
        game_prizes_kobo += amount
        break
      case "signup_bonus":
        signup_bonuses_kobo += amount
        break
      case "referral_bonus":
        referral_bonuses_kobo += amount
        break
      default:
        other_credits_kobo += amount
        break
    }
  })
  const daily_credits = Object.entries(creditMap).map(([date, total_kobo]) => ({ date, total_kobo })).sort((a, b) => a.date.localeCompare(b.date))

  // Top tasks
  const taskMap: Record<string, { title: string; count: number }> = {}
  ;(topTasksResult.data ?? []).forEach((r: Record<string, unknown>) => {
    const tid = r.task_id as string
    const title = (r.task as Record<string, unknown>)?.title as string ?? "Unknown"
    taskMap[tid] = { title, count: (taskMap[tid]?.count ?? 0) + 1 }
  })
  const top_tasks = Object.entries(taskMap).map(([task_id, v]) => ({ task_id, ...v })).sort((a, b) => b.count - a.count).slice(0, 10)

  // Withdrawal volume
  const wds = withdrawalsResult.data ?? []
  const withdrawal_volume = {
    pending_kobo: wds.filter(w => w.status === "pending").reduce((s, w) => s + w.amount, 0),
    approved_kobo: wds.filter(w => w.status === "approved").reduce((s, w) => s + w.amount, 0),
    paid_kobo: wds.filter(w => w.status === "paid").reduce((s, w) => s + w.amount, 0),
  }

  // Per-provider ad task logs (graceful fallback if table missing/errors)
  const adStats: Record<"ima" | "cpx" | "asterra", { completions: number; payout_kobo: number }> = {
    ima:     { completions: 0, payout_kobo: 0 },
    cpx:     { completions: 0, payout_kobo: 0 },
    asterra: { completions: 0, payout_kobo: 0 },
  }
  if (!adLogsResult.error && adLogsResult.data) {
    for (const row of adLogsResult.data) {
      const p = row.provider as string
      if (p === "ima" || p === "cpx" || p === "asterra") {
        adStats[p].completions += 1
        adStats[p].payout_kobo += Number(row.reward_kobo ?? 0)
      }
    }
  }

  // Platform settings map
  const settingsMap: Record<string, unknown> = {}
  if (!settingsResult.error && settingsResult.data) {
    for (const row of settingsResult.data) {
      settingsMap[row.key] = row.value
    }
  }

  const rawCpxShare = Number(settingsMap.cpx_user_share_percent)
  const cpxSharePercent =
    Number.isFinite(rawCpxShare) && rawCpxShare >= 1 && rawCpxShare <= 99
      ? rawCpxShare
      : 65

  // Recorded platform revenue (graceful fallback to 0 if tables aren't migrated yet)
  let advertiserFeeFromRefs = 0
  let verification_fee_revenue_kobo = 0
  const consumedAdvRefs = new Set<string>()

  if (!paystackRefsResult.error && paystackRefsResult.data) {
    for (const row of paystackRefsResult.data) {
      const amt = Number(row.amount_kobo ?? 0)
      if (row.purpose === "advertiser_submission_fee") {
        advertiserFeeFromRefs += amt
        if (typeof row.reference === "string" && row.reference) {
          consumedAdvRefs.add(row.reference)
        }
      } else if (row.purpose === "withdrawal_verification_fee") {
        verification_fee_revenue_kobo += amt
      }
    }
  }

  let extraPaidSubmissionsKobo = 0
  if (!paidSubmissionsResult.error && paidSubmissionsResult.data) {
    for (const row of paidSubmissionsResult.data) {
      const ref = typeof row.payment_reference === "string" ? row.payment_reference : ""
      if (ref && consumedAdvRefs.has(ref)) continue
      extraPaidSubmissionsKobo += Number(row.budget_kobo ?? 0)
    }
  }

  const advertiser_revenue_kobo = advertiserFeeFromRefs + extraPaidSubmissionsKobo

  const game_platform_cut_kobo =
    !gamePoolsResult.error && gamePoolsResult.data
      ? gamePoolsResult.data.reduce((sum, row) => sum + Number(row.platform_cut_kobo ?? 0), 0)
      : 0

  const est_cpx_margin_kobo =
    adStats.cpx.payout_kobo > 0
      ? Math.round(adStats.cpx.payout_kobo * ((100 - cpxSharePercent) / cpxSharePercent))
      : 0

  const total_recorded_revenue_kobo =
    advertiser_revenue_kobo +
    verification_fee_revenue_kobo +
    game_platform_cut_kobo +
    est_cpx_margin_kobo

  const net_margin_kobo = total_recorded_revenue_kobo - total_credits_kobo

  const profitability = {
    task_rewards_kobo,
    news_rewards_kobo,
    game_prizes_kobo,
    signup_bonuses_kobo,
    referral_bonuses_kobo,
    other_credits_kobo,
    total_credits_kobo,
    advertiser_revenue_kobo,
    verification_fee_revenue_kobo,
    game_platform_cut_kobo,
    est_cpx_margin_kobo,
    total_recorded_revenue_kobo,
    net_margin_kobo,
  }

  // Provider health & activity
  const hasStr = (v: unknown) => typeof v === "string" && v.trim().length > 0

  const imaEnabled = parseBoolSetting(settingsMap.ima_enabled, false)
  const imaConfigured = hasStr(settingsMap.ima_ad_tag_url)

  const cpxEnabled = parseBoolSetting(settingsMap.cpx_enabled, false)
  const cpxConfigured = hasStr(settingsMap.cpx_app_id) && hasStr(settingsMap.cpx_secure_hash_key)

  const asterraEnabled = parseBoolSetting(settingsMap.asterra_enabled, false)
  const asterraConfigured = hasStr(settingsMap.asterra_smartlink_url)

  const monetagEnabled = parseBoolSetting(settingsMap.monetag_enabled, false)
  const monetagConfigured = hasStr(settingsMap.monetag_multitag_script)

  const newsEnabled = parseBoolSetting(settingsMap.news_enabled, false)
  const newsEarnEnabled = parseBoolSetting(settingsMap.news_earn_enabled, false)

  const toStatus = (enabled: boolean, configured: boolean): ProviderStatus =>
    !enabled ? "disabled" : configured ? "active" : "needs_config"

  const providers: ProviderHealthRow[] = [
    {
      id: "ima",
      name: "IMA Video Ads",
      enabled: imaEnabled,
      configured: imaConfigured,
      status: toStatus(imaEnabled, imaConfigured),
      completions: adStats.ima.completions,
      payout_kobo: adStats.ima.payout_kobo,
      note: !imaEnabled
        ? "Disabled in settings"
        : !imaConfigured
        ? "Missing VAST ad tag URL"
        : "VAST tag configured",
    },
    {
      id: "cpx",
      name: "CPX Surveys",
      enabled: cpxEnabled,
      configured: cpxConfigured,
      status: toStatus(cpxEnabled, cpxConfigured),
      completions: adStats.cpx.completions,
      payout_kobo: adStats.cpx.payout_kobo,
      note: !cpxEnabled
        ? "Disabled in settings"
        : !cpxConfigured
        ? "Missing App ID or Secure Hash Key"
        : `${cpxSharePercent}% user share (~${100 - cpxSharePercent}% margin)`,
    },
    {
      id: "asterra",
      name: "Adsterra Smartlink",
      enabled: asterraEnabled,
      configured: asterraConfigured,
      status: toStatus(asterraEnabled, asterraConfigured),
      completions: adStats.asterra.completions,
      payout_kobo: adStats.asterra.payout_kobo,
      note: !asterraEnabled
        ? "Disabled in settings"
        : !asterraConfigured
        ? "Missing Smartlink URL"
        : "Smartlink configured",
    },
    {
      id: "monetag",
      name: "Monetag Multitag",
      enabled: monetagEnabled,
      configured: monetagConfigured,
      status: toStatus(monetagEnabled, monetagConfigured),
      completions: 0,
      payout_kobo: 0,
      note: !monetagEnabled
        ? "Disabled in settings"
        : !monetagConfigured
        ? "Missing Multitag script"
        : "Passive display revenue (tracked in Monetag)",
    },
    {
      id: "news",
      name: "News Reading",
      enabled: newsEnabled && newsEarnEnabled,
      configured: newsEnabled,
      status: !newsEarnEnabled
        ? "disabled"
        : newsEnabled
        ? "active"
        : "needs_config",
      completions: newsReadCompletions,
      payout_kobo: news_rewards_kobo,
      note: !newsEarnEnabled
        ? newsEnabled
          ? "Feed live; read-to-earn disabled"
          : "Disabled in settings"
        : !newsEnabled
        ? "Read-to-earn on, but News feed disabled"
        : "Read-to-earn active",
    },
  ]

  return NextResponse.json({
    data: {
      daily_signups,
      daily_completions,
      daily_credits,
      top_tasks,
      withdrawal_volume,
      profitability,
      providers,
    },
    error: null,
  })
}
