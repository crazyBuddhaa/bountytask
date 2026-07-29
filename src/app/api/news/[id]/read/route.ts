/**
 * POST /api/news/[id]/read
 *
 * Marks an article as opened and creates the news_reads row that the
 * heartbeat endpoint requires. Does NOT credit anything — earning now
 * happens via /api/news/[id]/heartbeat (per-minute time-on-page).
 *
 * Idempotent: calling it a second time is a no-op (returns alreadyRead: true).
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNewsSettings } from "@/lib/news"

export const dynamic = "force-dynamic"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: articleId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  // Verify the article exists and is active
  const { data: article } = await admin
    .from("news_articles")
    .select("id")
    .eq("id", articleId)
    .eq("is_active", true)
    .maybeSingle()

  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Idempotency check
  const { data: existing } = await admin
    .from("news_reads")
    .select("id, minutes_credited")
    .eq("user_id", user.id)
    .eq("article_id", articleId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      alreadyRead:    true,
      minutesCredited: existing.minutes_credited ?? 0,
    })
  }

  // Create the read record — earning happens via heartbeat
  await admin.from("news_reads").insert({
    user_id:    user.id,
    article_id: articleId,
    credited:   false,
  })

  const settings = await getNewsSettings()

  return NextResponse.json({
    alreadyRead:         false,
    earnEnabled:         settings.earnEnabled,
    koboPerMinute:       settings.earnKoboPerMinute,
    maxMinutesPerArticle: settings.earnMaxMinutesPerArticle,
    dailyCapMinutes:     settings.earnDailyCapMinutes,
  })
}
