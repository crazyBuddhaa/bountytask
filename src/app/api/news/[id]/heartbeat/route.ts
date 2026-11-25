/**
 * POST /api/news/[id]/heartbeat
 *
 * Called every 60 seconds while the user is actively reading an article.
 * Each accepted heartbeat = 1 minute of reading = credits news_earn_kobo_per_minute kobo.
 *
 * Anti-cheat rules:
 *   - Minimum 50 s between accepted heartbeats (prevent rapid-fire spam).
 *   - Per-article cap: minutes_credited < news_earn_max_minutes_per_article.
 *   - Daily cap: total minutes credited today < news_earn_daily_cap_minutes.
 *   - The /api/news/[id]/read endpoint must have been called first (row must exist).
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNewsSettings } from "@/lib/news"

export const dynamic = "force-dynamic"

const MIN_SECONDS_BETWEEN_HEARTBEATS = 50

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: articleId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  // ── Settings ────────────────────────────────────────────────────────────────
  const settings = await getNewsSettings()
  if (!settings.earnEnabled || settings.earnKoboPerMinute <= 0) {
    return NextResponse.json({ credited: false, reason: "earn_disabled" })
  }

  // Fetch article title for ledger note
  const { data: article } = await admin
    .from("news_articles")
    .select("title")
    .eq("id", articleId)
    .maybeSingle()

  // ── Atomic heartbeat check + credit + update (advisory-locked per user) ─────
  const { data: rpcData, error: rpcErr } = await admin.rpc("claim_news_heartbeat", {
    p_user_id:                 user.id,
    p_article_id:              articleId,
    p_earn_kobo_per_minute:    settings.earnKoboPerMinute,
    p_max_minutes_per_article: settings.earnMaxMinutesPerArticle,
    p_daily_cap_minutes:       settings.earnDailyCapMinutes,
    p_min_interval_seconds:    MIN_SECONDS_BETWEEN_HEARTBEATS,
    p_article_title:           article?.title ?? "",
  })

  if (rpcErr) {
    console.error("[news/heartbeat] claim_news_heartbeat error:", rpcErr)
    return NextResponse.json({ error: "Failed to record heartbeat" }, { status: 500 })
  }

  const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as {
    credited: boolean
    kobo: number
    reason: string
    minutes_on_article: number
    max_minutes: number
    daily_minutes_used: number
    daily_cap_minutes: number
  } | null

  if (!row) {
    return NextResponse.json({ error: "Failed to record heartbeat" }, { status: 500 })
  }

  if (row.reason === "not_started") {
    return NextResponse.json({ error: "Article not opened" }, { status: 409 })
  }

  if (!row.credited) {
    const reasonMap: Record<string, string> = {
      article_cap: "article_cap_reached",
      daily_cap:   "daily_cap_reached",
    }
    return NextResponse.json({
      credited:           false,
      reason:             reasonMap[row.reason] ?? row.reason,
      minutes_credited:   row.minutes_on_article,
      daily_minutes_used: row.daily_minutes_used,
      daily_cap_minutes:  row.daily_cap_minutes,
    })
  }

  return NextResponse.json({
    credited:           true,
    kobo:               row.kobo,
    minutes_credited:   row.minutes_on_article,
    daily_minutes_used: row.daily_minutes_used,
    daily_cap_minutes:  row.daily_cap_minutes,
  })
}
