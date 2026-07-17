import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { GAME_META, GAME_SLUGS, todayUTC } from "@/lib/games"
import type { GameSlug } from "@/lib/games"
import { appendLedger, assertSufficientBalance } from "@/lib/ledger"
import { z } from "zod"

export const dynamic = "force-dynamic"

/** Maps a GameSlug to its platform_settings key for the entry fee. */
export const SLUG_TO_FEE_KEY: Record<GameSlug, string> = {
  "wordle":          "game_entry_fee_wordle",
  "higher-or-lower": "game_entry_fee_higher_or_lower",
  "tap-target":      "game_entry_fee_tap_target",
  "2048":            "game_entry_fee_2048",
  "color-rush":      "game_entry_fee_color_rush",
  "word-scramble":   "game_entry_fee_word_scramble",
}

const schema = z.object({
  game_slug: z.enum([...GAME_SLUGS] as [GameSlug, ...GameSlug[]]),
})

/** Returns the start of the current ISO week (Monday, UTC) as YYYY-MM-DD. */
export function currentWeekStart(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun,1=Mon…
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

/**
 * POST /api/games/enter
 * Deducts the entry fee for a game session and records it in the weekly prize pool.
 * Returns { entry_id, fee_kobo } where entry_id is the ledger row id (used to
 * link the game session back to the payment for audit purposes).
 *
 * If fees are disabled or the fee for this game is 0, returns
 * { entry_id: null, fee_kobo: 0 } without touching the ledger.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const { game_slug } = parsed.data
  const admin = createAdminClient()

  // ── Read entry fee settings ────────────────────────────────────────────────
  const feeKey = SLUG_TO_FEE_KEY[game_slug]
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["game_entry_fees_enabled", feeKey])

  const settingsMap = Object.fromEntries((rows ?? []).map(r => [r.key, r.value]))
  const feesEnabled = settingsMap["game_entry_fees_enabled"] === true
  const feeKobo: number = feesEnabled ? (Number(settingsMap[feeKey]) || 0) : 0

  // Free game — no deduction needed
  if (feeKobo === 0) {
    return NextResponse.json({ data: { entry_id: null, fee_kobo: 0 } })
  }

  // ── Daily game: block double-entry for today ───────────────────────────────
  if (GAME_META[game_slug].isDaily) {
    const today = todayUTC()
    const { data: existing } = await admin
      .from("game_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("game_slug", game_slug)
      .eq("completed", true)
      .gte("played_at", `${today}T00:00:00Z`)
      .lte("played_at", `${today}T23:59:59Z`)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        error: "You have already played this game today.",
        code: "ALREADY_PLAYED",
      }, { status: 409 })
    }
  }

  // ── Deduct entry fee ───────────────────────────────────────────────────────
  try {
    await assertSufficientBalance(user.id, feeKobo)
  } catch {
    return NextResponse.json({
      error: `Insufficient balance. You need ₦${(feeKobo / 100).toFixed(2)} to play this game.`,
      code: "INSUFFICIENT_BALANCE",
    }, { status: 402 })
  }

  const ledgerEntry = await appendLedger({
    userId: user.id,
    type: "debit",
    delta: feeKobo,
    refType: "game_entry_fee",
    note: `Entry fee: ${game_slug}`,
  })

  // ── Record in prize pool (atomic upsert via RPC) ───────────────────────────
  const weekStart = currentWeekStart()
  await admin.rpc("record_game_entry", {
    p_game_slug:  game_slug,
    p_fee_kobo:   feeKobo,
    p_week_start: weekStart,
  })

  return NextResponse.json({ data: { entry_id: ledgerEntry.id, fee_kobo: feeKobo } })
}
