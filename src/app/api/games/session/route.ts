import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { GAME_SLUGS, GAME_META, todayUTC, getDailyWord, getDailyNumber } from "@/lib/games"
import type { GameSlug } from "@/lib/games"
import { z } from "zod"

const schema = z.object({
  game_slug:        z.enum([...GAME_SLUGS] as [GameSlug, ...GameSlug[]]),
  score:            z.number().int().min(0),
  completed:        z.boolean(),
  duration_seconds: z.number().int().min(0).max(3600).optional(),
  metadata:         z.record(z.unknown()).optional(),
  entry_id:         z.string().uuid().nullable().optional(), // ledger row id from /api/games/enter
  entry_fee_kobo:   z.number().int().min(0).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const { game_slug, score, completed, duration_seconds, metadata, entry_id, entry_fee_kobo } = parsed.data
  const admin = createAdminClient()

  // Daily game: check if already played today
  if (GAME_META[game_slug].isDaily && completed) {
    const today = todayUTC()
    const { data: existing } = await admin
      .from("game_sessions")
      .select("id,score")
      .eq("user_id", user.id)
      .eq("game_slug", game_slug)
      .eq("completed", true)
      .gte("played_at", `${today}T00:00:00Z`)
      .lte("played_at", `${today}T23:59:59Z`)
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json({
        error: "Already played today",
        code: "ALREADY_PLAYED",
        previous_score: existing.score,
      }, { status: 409 })
    }
  }

  const { data, error } = await admin
    .from("game_sessions")
    .insert({
      user_id:          user.id,
      game_slug,
      score,
      completed,
      duration_seconds: duration_seconds ?? null,
      metadata:         { ...metadata ?? {}, ...(entry_id ? { entry_id } : {}) },
      entry_fee_kobo:   entry_fee_kobo ?? 0,
    })
    .select("id,score,played_at")
    .single()

  if (error) {
    console.error("[games/session] insert error:", error)
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 })
  }

  return NextResponse.json({ data })
}
