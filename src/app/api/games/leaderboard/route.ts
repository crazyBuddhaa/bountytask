import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { GAME_SLUGS } from "@/lib/games"
import type { GameSlug } from "@/lib/games"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const game = req.nextUrl.searchParams.get("game") as GameSlug | null
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "10"), 50)

  if (!game || !GAME_SLUGS.includes(game)) {
    return NextResponse.json({ error: "Invalid game slug" }, { status: 400 })
  }

  const admin = createAdminClient()

  // Best completed score per user this week
  const weekStart = getWeekStart()

  const { data, error } = await admin
    .from("game_sessions")
    .select("user_id, score, played_at, users!inner(username, full_name, avatar_url)")
    .eq("game_slug", game)
    .eq("completed", true)
    .gte("played_at", weekStart)
    .order("score", { ascending: false })
    .limit(200) // fetch more, deduplicate in JS

  if (error) {
    console.error("[games/leaderboard] query error:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }

  // Deduplicate: best score per user
  const seen = new Map<string, typeof data[0]>()
  for (const row of (data ?? [])) {
    const existing = seen.get(row.user_id)
    if (!existing || row.score > existing.score) seen.set(row.user_id, row)
  }

  const ranked = [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row, i) => {
      const uRaw = row.users as { username: string; full_name: string; avatar_url: string } | { username: string; full_name: string; avatar_url: string }[] | null
      const u = Array.isArray(uRaw) ? (uRaw[0] ?? null) : uRaw
      const isMe = row.user_id === user.id
      const rank = i + 1
      // Mask names for ranks 4+, unless it's the current user
      const displayName = (isMe || rank <= 3)
        ? (u?.full_name ?? u?.username ?? "Player")
        : maskName(u?.full_name ?? u?.username ?? "Player")
      return {
        rank,
        user_id: row.user_id,
        is_me: isMe,
        display_name: displayName,
        avatar_url: isMe ? u?.avatar_url : null,
        score: row.score,
        last_played_at: row.played_at,
      }
    })

  // Find requesting user's rank if not in top N
  let myRank: number | null = null
  if (!ranked.some(r => r.is_me)) {
    const myIdx = [...seen.values()]
      .sort((a, b) => b.score - a.score)
      .findIndex(r => r.user_id === user.id)
    myRank = myIdx >= 0 ? myIdx + 1 : null
  }

  return NextResponse.json({ data: ranked, my_rank: myRank, week_start: weekStart })
}

function getWeekStart(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString()
}

function maskName(name: string): string {
  const parts = name.trim().split(" ")
  return parts.map((p, i) => i === 0 ? p[0] + "***" : p[0] + "***").join(" ")
}
