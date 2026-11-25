/**
 * Adsterra smartlink click endpoint.
 *
 * Called by the client BEFORE opening the smartlink URL so the server can:
 *   1. Authenticate the request (logged-in user only)
 *   2. Enforce per-user cooldown (default 30 min between clicks)
 *   3. Enforce daily cap
 *   4. Enforce platform-wide tier daily limit
 *   5. Credit the ledger optimistically (no postback will ever arrive)
 *   6. Return the resolved smartlink URL for the client to window.open()
 *
 * POST /api/asterra/click
 * Body: {} (user identity comes from the auth session, not the body)
 *
 * Responses:
 *   200 { ok: true, url: string }     — credit applied, open this URL
 *   401 { error: "Unauthorized" }
 *   429 { error: "cooldown",  nextAvailableAt: ISO string }
 *   429 { error: "Daily cap reached" }
 *   429 { error: "Daily platform limit reached" }
 *   503 { error: "Provider not configured" }
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getAsterraSettings,
  buildAsterraSmartlinkUrl,
  ASTERRA_COOLDOWN_MINUTES,
} from "@/lib/asterra"
import { createNotification } from "@/lib/notifications"
import { recalcUserTier } from "@/lib/tiers"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  const settings = await getAsterraSettings()
  if (!settings.enabled || !settings.smartlinkUrl) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 })
  }

  // ── Look up user's tier daily limit ───────────────────────────────────────
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("users")
    .select("tier")
    .eq("id", user.id)
    .single()

  const { data: tier } = await admin
    .from("tiers")
    .select("daily_task_limit")
    .eq("id", profile?.tier ?? 1)
    .single()

  const tierDailyLimit = tier?.daily_task_limit ?? 10

  // ── Atomic cooldown + daily cap + tier limit + log + ledger credit ────────
  const sessionId = crypto.randomUUID()
  const { data: rpcData, error: rpcErr } = await admin.rpc("claim_ad_reward", {
    p_user_id:          user.id,
    p_provider:         "asterra",
    p_ad_type:          "mixed",
    p_reward_kobo:      settings.rewardKobo,
    p_session_id:       sessionId,
    p_note:             "Ad task reward — asterra (mixed)",
    p_daily_cap:        settings.dailyCap,
    p_cooldown_seconds: ASTERRA_COOLDOWN_MINUTES * 60,
    p_tier_daily_limit: tierDailyLimit,
  })

  if (rpcErr) {
    console.error("[asterra/click] claim_ad_reward error:", rpcErr)
    return NextResponse.json({ error: "Failed to process reward" }, { status: 500 })
  }

  const rpcRow = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as {
    ok: boolean
    reason: string
    retry_after: number
    daily_used: number
    tier_used: number
  } | null

  if (!rpcRow) {
    return NextResponse.json({ error: "Failed to process reward" }, { status: 500 })
  }

  if (!rpcRow.ok) {
    if (rpcRow.reason === "cooldown") {
      const nextAvailableAt = new Date(Date.now() + (rpcRow.retry_after ?? 0) * 1000).toISOString()
      return NextResponse.json(
        { error: "cooldown", nextAvailableAt },
        { status: 429 }
      )
    }
    if (rpcRow.reason === "daily_cap") {
      return NextResponse.json({ error: "Daily cap reached" }, { status: 429 })
    }
    if (rpcRow.reason === "tier_limit") {
      return NextResponse.json({ error: "Daily platform limit reached" }, { status: 429 })
    }
    if (rpcRow.reason === "duplicate") {
      return NextResponse.json({ error: "Already credited" }, { status: 409 })
    }
    return NextResponse.json({ error: "Unable to claim reward" }, { status: 400 })
  }

  // ── Non-blocking notification + tier recalculation ────────────────────────
  const naira = (settings.rewardKobo / 100).toFixed(2)
  await Promise.allSettled([
    createNotification({
      userId:  user.id,
      type:    "task_approved",
      title:   "Ad Task Completed! 🎯",
      message: `₦${naira} credited for completing a smartlink offer.`,
    }),
    recalcUserTier(user.id),
  ])

  // ── Return resolved URL ───────────────────────────────────────────────────
  const url = buildAsterraSmartlinkUrl(settings.smartlinkUrl, user.id)
  return NextResponse.json({ ok: true, url })
}
