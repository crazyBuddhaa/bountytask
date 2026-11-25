import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { GAME_SLUGS, GAME_META, todayUTC } from "@/lib/games"
import type { GameSlug } from "@/lib/games"
import { SLUG_TO_FEE_KEY } from "@/app/api/games/enter/route"
import { parseBoolSetting } from "@/lib/security"
import { z } from "zod"

/**
 * Per-game realistic score ceilings derived from each game's scoring formula:
 * - wordle:          max 600 (1 guess = 600)
 * - higher-or-lower: max 350 (1 guess = 350)
 * - tap-target:      1 pt per hit in 30s
 * - 2048:            tile merge score
 * - color-rush:      1 pt per correct match
 * - word-scramble:   10 rounds × max (100 + 15*10 = 250) = 2500
 */
const GAME_SCORE_CEILINGS: Record<GameSlug, number> = {
  "wordle":          1000,
  "higher-or-lower": 500,
  "tap-target":      500,
  "2048":            100000,
  "color-rush":      500,
  "word-scramble":   2500,
}

const schema = z.object({
  game_slug:        z.enum([...GAME_SLUGS] as [GameSlug, ...GameSlug[]]),
  score:            z.number().int().min(0),
  completed:        z.boolean(),
  duration_seconds: z.number().int().min(0).max(3600).optional(),
  metadata:         z.record(z.unknown()).optional(),
  entry_id:         z.string().uuid().nullable().optional(), // single-use token from /api/games/enter
  entry_fee_kobo:   z.number().int().min(0).optional(),      // ignored; derived from server token
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const { game_slug, score, completed, duration_seconds, metadata, entry_id } = parsed.data

  // Enforce per-game score ceiling
  const maxScore = GAME_SCORE_CEILINGS[game_slug]
  if (score > maxScore) {
    return NextResponse.json({ error: "Invalid score for this game" }, { status: 400 })
  }

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
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        error: "Already played today",
        code: "ALREADY_PLAYED",
        previous_score: existing.score,
      }, { status: 409 })
    }
  }

  // Check if entry fees are enabled for this game
  const feeKey = SLUG_TO_FEE_KEY[game_slug]
  const { data: feeRows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["game_entry_fees_enabled", feeKey])

  const settingsMap = Object.fromEntries((feeRows ?? []).map(r => [r.key, r.value]))
  const feesEnabled = parseBoolSetting(settingsMap["game_entry_fees_enabled"], false)
  const configuredFeeKobo = feesEnabled ? (Number(settingsMap[feeKey]) || 0) : 0

  let verifiedEntryFeeKobo = 0

  if (configuredFeeKobo > 0 || entry_id) {
    if (!entry_id) {
      return NextResponse.json({
        error: "A valid game entry token is required to submit this session.",
        code: "ENTRY_TOKEN_REQUIRED",
      }, { status: 403 })
    }

    const { data: consumedToken, error: tokenErr } = await admin
      .from("game_entry_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", entry_id)
      .eq("user_id", user.id)
      .eq("game_slug", game_slug)
      .is("used_at", null)
      .select("id, entry_fee_kobo")
      .maybeSingle()

    if (tokenErr || !consumedToken) {
      return NextResponse.json({
        error: "Invalid or already-used game entry token.",
        code: "INVALID_ENTRY_TOKEN",
      }, { status: 403 })
    }

    if (configuredFeeKobo > 0 && (consumedToken.entry_fee_kobo ?? 0) <= 0) {
      return NextResponse.json({
        error: "Entry token does not cover the required game entry fee.",
        code: "INVALID_ENTRY_TOKEN",
      }, { status: 403 })
    }

    verifiedEntryFeeKobo = consumedToken.entry_fee_kobo ?? 0
  }

  const { data, error } = await admin
    .from("game_sessions")
    .insert({
      user_id:          user.id,
      game_slug,
      score,
      completed,
      duration_seconds: duration_seconds ?? null,
      metadata:         { ...(metadata ?? {}), ...(entry_id ? { entry_id } : {}) },
      entry_fee_kobo:   verifiedEntryFeeKobo,
    })
    .select("id,score,played_at")
    .single()

  if (error) {
    console.error("[games/session] insert error:", error)
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 })
  }

  return NextResponse.json({ data })
}
