import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export interface Payout {
  id:            string
  game_slug:     string
  week_start:    string
  rank:          number
  score:         number
  payout_kobo:   number
  created_at:    string
}

/**
 * GET /api/games/my-payouts
 * Returns the authenticated user's leaderboard payout history, newest first.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  const { data, error } = await admin
    .from("leaderboard_payouts")
    .select("id, game_slug, week_start, rank, score, payout_kobo, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("[games/my-payouts]", error)
    return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 })
  }

  const total = (data ?? []).reduce((sum, p) => sum + p.payout_kobo, 0)

  return NextResponse.json({ data: data ?? [], total_earned_kobo: total })
}
