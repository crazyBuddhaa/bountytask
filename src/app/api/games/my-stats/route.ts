import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLiveBalance } from "@/lib/ledger"
import { GAME_SLUGS } from "@/lib/games"
import type { GameSlug } from "@/lib/games"
import { SLUG_TO_FEE_KEY } from "@/app/api/games/enter/route"

export interface GameStat {
  game_slug: GameSlug
  best_score: number
  total_plays: number
  completed_today: boolean
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // Fetch sessions + fee settings + balance in parallel
  const feeKeys = ["game_entry_fees_enabled", ...Object.values(SLUG_TO_FEE_KEY)]
  const [sessionsResult, feeRows, balance] = await Promise.all([
    admin
      .from("game_sessions")
      .select("game_slug, score, completed, played_at")
      .eq("user_id", user.id)
      .order("played_at", { ascending: false }),
    admin.from("platform_settings").select("key, value").in("key", feeKeys),
    getLiveBalance(user.id),
  ])

  if (sessionsResult.error) {
    console.error("[games/my-stats] error:", sessionsResult.error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }

  // Per-game stats
  const data = sessionsResult.data ?? []
  const stats: Record<GameSlug, GameStat> = {} as Record<GameSlug, GameStat>
  for (const slug of GAME_SLUGS) {
    const rows = data.filter(r => r.game_slug === slug)
    const completedRows = rows.filter(r => r.completed)
    const todayRows = completedRows.filter(r => r.played_at.slice(0, 10) === today)
    stats[slug] = {
      game_slug:      slug,
      best_score:     completedRows.length ? Math.max(...completedRows.map(r => r.score)) : 0,
      total_plays:    completedRows.length,
      completed_today: todayRows.length > 0,
    }
  }

  // Entry fee map
  const feeMap = Object.fromEntries((feeRows.data ?? []).map(r => [r.key, r.value]))
  const feesEnabled = feeMap["game_entry_fees_enabled"] === true
  const entryFees: Record<GameSlug, number> = {} as Record<GameSlug, number>
  for (const slug of GAME_SLUGS) {
    entryFees[slug] = feesEnabled ? (Number(feeMap[SLUG_TO_FEE_KEY[slug]]) || 0) : 0
  }

  return NextResponse.json({ data: stats, fees_enabled: feesEnabled, entry_fees: entryFees, balance })
}
