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
import { appendLedger } from "@/lib/ledger"
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

  // ── Find the read record ────────────────────────────────────────────────────
  const { data: readRow } = await admin
    .from("news_reads")
    .select("id, minutes_credited, last_heartbeat_at")
    .eq("user_id", user.id)
    .eq("article_id", articleId)
    .maybeSingle()

  if (!readRow) {
    // Article hasn't been opened yet — client should call /read first
    return NextResponse.json({ error: "Article not opened" }, { status: 409 })
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  if (readRow.last_heartbeat_at) {
    const secondsSinceLast =
      (Date.now() - new Date(readRow.last_heartbeat_at).getTime()) / 1000
    if (secondsSinceLast < MIN_SECONDS_BETWEEN_HEARTBEATS) {
      return NextResponse.json({ credited: false, reason: "too_soon" })
    }
  }

  // ── Per-article cap ─────────────────────────────────────────────────────────
  if (readRow.minutes_credited >= settings.earnMaxMinutesPerArticle) {
    // Update last_heartbeat_at so we don't get bombarded, but no credit
    await admin
      .from("news_reads")
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("id", readRow.id)
    return NextResponse.json({
      credited: false,
      reason: "article_cap_reached",
      minutes_credited: readRow.minutes_credited,
    })
  }

  // ── Daily cap ───────────────────────────────────────────────────────────────
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { data: todayRows } = await admin
    .from("news_reads")
    .select("minutes_credited")
    .eq("user_id", user.id)
    .gte("read_at", startOfDay.toISOString())

  const dailyMinutesUsed = (todayRows ?? []).reduce(
    (sum, r) => sum + (r.minutes_credited ?? 0),
    0
  )

  if (dailyMinutesUsed >= settings.earnDailyCapMinutes) {
    return NextResponse.json({
      credited: false,
      reason: "daily_cap_reached",
      daily_minutes_used: dailyMinutesUsed,
    })
  }

  // ── Credit ──────────────────────────────────────────────────────────────────
  const now = new Date().toISOString()

  await appendLedger({
    userId:  user.id,
    type:    "credit",
    delta:   settings.earnKoboPerMinute,
    refType: "news_read_reward",
    refId:   articleId,
  })

  await admin
    .from("news_reads")
    .update({
      minutes_credited:  readRow.minutes_credited + 1,
      last_heartbeat_at: now,
      credited:          true,
    })
    .eq("id", readRow.id)

  return NextResponse.json({
    credited:           true,
    kobo:               settings.earnKoboPerMinute,
    minutes_credited:   readRow.minutes_credited + 1,
    daily_minutes_used: dailyMinutesUsed + 1,
    daily_cap_minutes:  settings.earnDailyCapMinutes,
  })
}
