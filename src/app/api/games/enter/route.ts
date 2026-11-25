import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { GAME_META, GAME_SLUGS, todayUTC } from "@/lib/games"
import type { GameSlug } from "@/lib/games"
import { parseBoolSetting } from "@/lib/security"
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
 * Atomically deducts the entry fee for a game session, records it in the weekly
 * prize pool, and issues a single-use server-side game_entry_tokens id.
 * Returns { entry_id, entry_token, fee_kobo } where entry_id / entry_token is
 * the single-use token consumed by POST /api/games/session.
 *
 * If fees are disabled or the fee for this game is 0, returns
 * { entry_id: null, entry_token: null, fee_kobo: 0 } without touching the ledger.
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
  const feesEnabled = parseBoolSetting(settingsMap["game_entry_fees_enabled"], false)
  const feeKobo: number = feesEnabled ? (Number(settingsMap[feeKey]) || 0) : 0

  // Free game — no deduction needed
  if (feeKobo === 0) {
    return NextResponse.json({ data: { entry_id: null, entry_token: null, fee_kobo: 0 } })
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

  // ── Atomic balance check + ledger debit + prize pool + entry token ─────────
  const weekStart = currentWeekStart()
  const { data: rpcData, error: rpcErr } = await admin.rpc("safe_game_entry_debit", {
    p_user_id:    user.id,
    p_game_slug:  game_slug,
    p_fee_kobo:   feeKobo,
    p_week_start: weekStart,
    p_note:       `Entry fee: ${game_slug}`,
  })

  if (rpcErr) {
    console.error("[games/enter] safe_game_entry_debit error:", rpcErr)
    return NextResponse.json({ error: "Failed to process game entry" }, { status: 500 })
  }

  const rpcRow = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as {
    ok: boolean
    entry_token_id: string | null
    ledger_id: string | null
    pool_id: string | null
    new_balance_kobo: number
    err: string | null
  } | null

  if (!rpcRow || !rpcRow.ok || !rpcRow.entry_token_id) {
    return NextResponse.json({
      error: rpcRow?.err ?? `Insufficient balance. You need ₦${(feeKobo / 100).toFixed(2)} to play this game.`,
      code: "INSUFFICIENT_BALANCE",
    }, { status: 402 })
  }

  return NextResponse.json({
    data: {
      entry_id:    rpcRow.entry_token_id,
      entry_token: rpcRow.entry_token_id,
      fee_kobo:    feeKobo,
    },
  })
}
