import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseBoolSetting } from "@/lib/security"
import { flagUser } from "@/lib/fraud"
import { createNotification } from "@/lib/notifications"
import { formatCurrency } from "@/lib/utils"

export const dynamic = "force-dynamic"

const STRIKE_COOLDOWN_MS = 30 * 60 * 1000 // At most 1 strike recorded per 30 minutes

const reportSchema = z.object({
  page_path: z.string().max(200).optional(),
  method: z.enum(["dom", "network", "both"]).optional(),
})

async function getAdBlockSettings() {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", [
      "adblock_detector_enabled",
      "adblock_warning_threshold",
      "adblock_penalty_kobo",
    ])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  return {
    enabled: parseBoolSetting(s.adblock_detector_enabled, true),
    warningThreshold: Math.max(0, Math.min(10, Number(s.adblock_warning_threshold ?? 2) || 0)),
    penaltyKobo: Math.max(0, Math.min(500_000, Number(s.adblock_penalty_kobo ?? 5000) || 0)),
  }
}

/**
 * GET /api/anti-adblock/report
 * Returns whether the detector is enabled and the user's strike count today.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  }

  const settings = await getAdBlockSettings()
  const admin = createAdminClient()
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { count } = await admin
    .from("adblock_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("detected_at", todayStart.toISOString())

  return NextResponse.json({
    data: {
      enabled: settings.enabled,
      warningThreshold: settings.warningThreshold,
      penaltyKobo: settings.penaltyKobo,
      strikesToday: count ?? 0,
    },
    error: null,
  })
}

/**
 * POST /api/anti-adblock/report
 * Records an ad-blocker detection event (max 1 strike per 30 minutes).
 * Strikes 1..warningThreshold issue a warning; subsequent strikes apply a
 * capped penalty debit and create a fraud flag + notification.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  }

  const settings = await getAdBlockSettings()
  if (!settings.enabled) {
    return NextResponse.json({ data: { enabled: false, action: "disabled" }, error: null })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = reportSchema.safeParse(body)
  const pagePath = parsed.success ? (parsed.data.page_path ?? "/dashboard") : "/dashboard"

  const admin = createAdminClient()
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)

  // Check recent strikes today (and cooldown so page refreshes don't drain balance)
  const { data: todayEvents, error: fetchErr } = await admin
    .from("adblock_events")
    .select("id, action, penalty_kobo, detected_at")
    .eq("user_id", user.id)
    .gte("detected_at", todayStart.toISOString())
    .order("detected_at", { ascending: false })

  if (fetchErr) {
    // Graceful fallback if migration isn't applied yet
    return NextResponse.json({
      data: {
        enabled: true,
        action: "warning",
        strikesToday: 1,
        warningThreshold: settings.warningThreshold,
        penaltyKobo: settings.penaltyKobo,
        debitedKobo: 0,
        cooldownActive: false,
      },
      error: null,
    })
  }

  const existingCount = todayEvents?.length ?? 0
  const lastEvent = todayEvents?.[0]

  if (lastEvent && now.getTime() - new Date(lastEvent.detected_at).getTime() < STRIKE_COOLDOWN_MS) {
    return NextResponse.json({
      data: {
        enabled: true,
        action: lastEvent.action,
        strikesToday: existingCount,
        warningThreshold: settings.warningThreshold,
        penaltyKobo: settings.penaltyKobo,
        debitedKobo: 0,
        cooldownActive: true,
      },
      error: null,
    })
  }

  const newStrikeNumber = existingCount + 1
  const shouldPenalize =
    newStrikeNumber > settings.warningThreshold && settings.penaltyKobo > 0

  let debitedKobo = 0
  let ledgerEntryId: string | null = null

  if (shouldPenalize) {
    const { data: rpcRows } = await admin.rpc("safe_adblock_penalty_debit", {
      p_user_id: user.id,
      p_penalty_kobo: settings.penaltyKobo,
      p_note: `Ad-blocker penalty (strike #${newStrikeNumber} today on ${pagePath})`,
    })
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
    debitedKobo = Number(row?.debited_kobo ?? 0)
    ledgerEntryId = (row?.ledger_id as string | null) ?? null
  }

  const action: "warning" | "penalty" = shouldPenalize ? "penalty" : "warning"

  await admin.from("adblock_events").insert({
    user_id: user.id,
    page_path: pagePath,
    action,
    penalty_kobo: debitedKobo,
    ledger_entry_id: ledgerEntryId,
  })

  if (shouldPenalize) {
    // Flag repeat offender for admin fraud queue + notify user
    await Promise.allSettled([
      flagUser({
        userId: user.id,
        reason: `Repeated ad-blocker usage (${newStrikeNumber} strikes today on ${pagePath})${
          debitedKobo > 0 ? ` — debited ${formatCurrency(debitedKobo)}` : ""
        }`,
        severity: newStrikeNumber >= 5 ? "high" : "medium",
      }),
      createNotification({
        userId: user.id,
        type: "fraud_flag",
        title: "Ad-Blocker Penalty Applied",
        message:
          debitedKobo > 0
            ? `${formatCurrency(debitedKobo)} was deducted from your wallet for continuing to use an ad blocker after warnings. Disable your ad blocker to avoid further penalties.`
            : "Repeated ad-blocker usage was flagged on your account. Please disable your ad blocker to avoid wallet penalties.",
        refId: ledgerEntryId ?? undefined,
      }),
    ])
  }

  return NextResponse.json({
    data: {
      enabled: true,
      action,
      strikesToday: newStrikeNumber,
      warningThreshold: settings.warningThreshold,
      penaltyKobo: settings.penaltyKobo,
      debitedKobo,
      cooldownActive: false,
    },
    error: null,
  })
}
