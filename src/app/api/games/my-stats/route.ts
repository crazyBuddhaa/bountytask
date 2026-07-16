import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { GAME_SLUGS } from "@/lib/games"
import type { GameSlug } from "@/lib/games"

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

  const { data, error } = await admin
    .from("game_sessions")
    .select("game_slug, score, completed, played_at")
    .eq("user_id", user.id)
    .order("played_at", { ascending: false })

  if (error) {
    console.error("[games/my-stats] error:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }

  const stats: Record<GameSlug, GameStat> = {} as Record<GameSlug, GameStat>
  for (const slug of GAME_SLUGS) {
    const rows = (data ?? []).filter(r => r.game_slug === slug)
    const completedRows = rows.filter(r => r.completed)
    const todayRows = completedRows.filter(r => r.played_at.slice(0, 10) === today)
    stats[slug] = {
      game_slug: slug,
      best_score: completedRows.length ? Math.max(...completedRows.map(r => r.score)) : 0,
      total_plays: completedRows.length,
      completed_today: todayRows.length > 0,
    }
  }

  return NextResponse.json({ data: stats })
}
