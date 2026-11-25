import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAdminRole } from "@/lib/security"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/games/pools
 * Returns prize pools ordered newest-first, with payout records for settled pools.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await getActiveAdminRole(user.id)).isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()

  const { data: pools, error } = await admin
    .from("game_prize_pools")
    .select(`
      *,
      leaderboard_payouts (
        id, rank, score, payout_kobo,
        user:users ( full_name, username )
      )
    `)
    .order("week_start", { ascending: false })
    .order("game_slug", { ascending: true })

  if (error) {
    console.error("[admin/games/pools]", error)
    return NextResponse.json({ error: "Failed to fetch pools" }, { status: 500 })
  }

  return NextResponse.json({ data: pools ?? [] })
}
