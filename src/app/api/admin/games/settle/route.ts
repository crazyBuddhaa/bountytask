import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendLedger } from "@/lib/ledger"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = "force-dynamic"

const schema = z.object({ pool_id: z.string().uuid() })

async function assertAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return data && ["admin", "super_admin"].includes(data.role)
}

/** Split prize_pool_kobo among up to 3 winners (50 / 30 / 20 %). */
function calcSplits(pool: number, count: number): number[] {
  if (count === 0) return []
  if (count === 1) return [pool]
  if (count === 2) {
    const first = Math.floor(pool * 0.65)
    return [first, pool - first]
  }
  const first  = Math.floor(pool * 0.5)
  const second = Math.floor(pool * 0.3)
  return [first, second, pool - first - second]
}

/**
 * POST /api/admin/games/settle
 * Body: { pool_id }
 * Reads the top 3 completed scores for the pool's game + week, credits winners,
 * records leaderboard_payouts rows, and marks the pool as settled.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

  const admin = createAdminClient()

  // ── Fetch pool ─────────────────────────────────────────────────────────────
  const { data: pool, error: poolErr } = await admin
    .from("game_prize_pools")
    .select("*")
    .eq("id", parsed.data.pool_id)
    .single()

  if (poolErr || !pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  if (pool.settled)     return NextResponse.json({ error: "Pool already settled" }, { status: 409 })
  if (pool.prize_pool_kobo === 0) {
    return NextResponse.json({ error: "Prize pool is empty — nothing to settle" }, { status: 400 })
  }

  // ── Get weekly leaderboard for this game ───────────────────────────────────
  // Best completed score per user during the pool's week (Mon 00:00 → Sun 23:59 UTC)
  const weekEnd = new Date(`${pool.week_start}T00:00:00Z`)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  const weekEndStr = weekEnd.toISOString()

  const { data: sessions, error: sessErr } = await admin
    .from("game_sessions")
    .select("user_id, score")
    .eq("game_slug", pool.game_slug)
    .eq("completed", true)
    .gte("played_at", `${pool.week_start}T00:00:00Z`)
    .lt("played_at", weekEndStr)
    .order("score", { ascending: false })

  if (sessErr) {
    console.error("[settle]", sessErr)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }

  // Deduplicate: best score per user
  const seen = new Map<string, number>()
  for (const s of (sessions ?? [])) {
    if (!seen.has(s.user_id) || s.score > seen.get(s.user_id)!) {
      seen.set(s.user_id, s.score)
    }
  }
  const ranked = [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const splits = calcSplits(pool.prize_pool_kobo, ranked.length)

  // ── Credit winners + insert payout rows ───────────────────────────────────
  const payoutRows = []
  for (let i = 0; i < ranked.length; i++) {
    const [winnerId, score] = ranked[i]
    const payoutKobo = splits[i]
    const { data: winnerProfile } = await admin
      .from("users")
      .select("full_name, username")
      .eq("id", winnerId)
      .single()

    const ledgerEntry = await appendLedger({
      userId:    winnerId,
      type:      "credit",
      delta:     payoutKobo,
      refType:   "game_prize",
      refId:     pool.id,
      note:      `${pool.game_slug} leaderboard prize — week of ${pool.week_start} — rank #${i + 1}`,
      createdBy: user.id,
    })

    payoutRows.push({
      prize_pool_id: pool.id,
      user_id:       winnerId,
      game_slug:     pool.game_slug,
      week_start:    pool.week_start,
      rank:          i + 1,
      score,
      payout_kobo:   payoutKobo,
      ledger_id:     ledgerEntry.id,
      display_name:  winnerProfile?.full_name ?? winnerProfile?.username ?? "Unknown",
    })
  }

  if (payoutRows.length > 0) {
    await admin.from("leaderboard_payouts").insert(
      payoutRows.map(({ display_name: _, ...r }) => r)
    )
  }

  // ── Mark pool as settled ───────────────────────────────────────────────────
  await admin
    .from("game_prize_pools")
    .update({ settled: true, settled_at: new Date().toISOString(), settled_by: user.id })
    .eq("id", pool.id)

  await auditLog({
    actorId:    user.id,
    action:     "games.settle",
    targetType: "game_prize_pools",
    targetId:   pool.id,
    details:    { game_slug: pool.game_slug, week_start: pool.week_start, payouts: payoutRows.length, prize_pool_kobo: pool.prize_pool_kobo },
    ipAddress:  getClientIp(req.headers),
  })

  return NextResponse.json({
    data: {
      settled:  true,
      payouts:  payoutRows.map(r => ({ rank: r.rank, display_name: r.display_name, score: r.score, payout_kobo: r.payout_kobo })),
      pool_id:  pool.id,
    },
  })
}
