import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { GAME_SLUGS } from "@/lib/games"
import type { GameSlug } from "@/lib/games"

export const dynamic = "force-dynamic"

/**
 * GET /api/games/pools
 * Returns this week's active (unsettled) prize pools so the games hub can
 * display live totals. Settled pools are excluded — they've already paid out.
 *
 * Response:
 * {
 *   data: {
 *     total_prize_pool_kobo: number,          // sum across all games
 *     by_game: Record<GameSlug, number>,      // per-game prize_pool_kobo (0 if none yet)
 *   }
 * }
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  // Current ISO week start (Monday UTC)
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  const weekStart = monday.toISOString().slice(0, 10)

  const { data: pools, error } = await admin
    .from("game_prize_pools")
    .select("game_slug, prize_pool_kobo, total_entries")
    .eq("week_start", weekStart)
    .eq("settled", false)

  if (error) {
    console.error("[games/pools]", error)
    return NextResponse.json({ error: "Failed to fetch pools" }, { status: 500 })
  }

  const byGame: Record<GameSlug, { prize_pool_kobo: number; total_entries: number }> =
    Object.fromEntries(GAME_SLUGS.map(s => [s, { prize_pool_kobo: 0, total_entries: 0 }])) as Record<
      GameSlug,
      { prize_pool_kobo: number; total_entries: number }
    >

  let total = 0
  for (const p of pools ?? []) {
    const slug = p.game_slug as GameSlug
    if (byGame[slug] !== undefined) {
      byGame[slug].prize_pool_kobo  = p.prize_pool_kobo
      byGame[slug].total_entries    = p.total_entries
      total += p.prize_pool_kobo
    }
  }

  return NextResponse.json({
    data: {
      week_start:           weekStart,
      total_prize_pool_kobo: total,
      by_game:              byGame,
    },
  })
}
