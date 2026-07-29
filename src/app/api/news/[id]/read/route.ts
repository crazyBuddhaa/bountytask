/**
 * POST /api/news/[id]/read
 *
 * Marks an article as read for the authenticated user.
 * If earn-on-read is enabled and the user hasn't hit the daily cap,
 * credits a small ledger entry and returns { credited: true, kobo: N }.
 *
 * Idempotent: a second call for the same article returns { alreadyRead: true }
 * without touching the ledger.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNewsSettings } from "@/lib/news"
import { appendLedger } from "@/lib/ledger"

export const dynamic = "force-dynamic"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: articleId } = await params
  const admin = createAdminClient()

  // Verify the article exists and is active
  const { data: article } = await admin
    .from("news_articles")
    .select("id")
    .eq("id", articleId)
    .eq("is_active", true)
    .maybeSingle()

  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Idempotency: already read?
  const { data: existing } = await admin
    .from("news_reads")
    .select("id, credited")
    .eq("user_id",   user.id)
    .eq("article_id", articleId)
    .maybeSingle()

  if (existing) return NextResponse.json({ credited: false, alreadyRead: true })

  // ── Earn logic ────────────────────────────────────────────────────────────
  const settings = await getNewsSettings()
  let credited   = false

  if (settings.earnEnabled && settings.earnKoboPerRead > 0) {
    // Count articles credited today (UTC)
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const { count: readsToday } = await admin
      .from("news_reads")
      .select("id", { count: "exact", head: true })
      .eq("user_id",  user.id)
      .eq("credited", true)
      .gte("read_at", startOfDay.toISOString())

    if ((readsToday ?? 0) < settings.earnDailyCap) {
      await appendLedger(user.id, "credit", settings.earnKoboPerRead, "news_read_reward", articleId)
      credited = true
    }
  }

  // Insert the read record
  await admin.from("news_reads").insert({
    user_id:    user.id,
    article_id: articleId,
    credited,
  })

  return NextResponse.json({
    credited,
    alreadyRead: false,
    kobo: credited ? settings.earnKoboPerRead : 0,
  })
}
