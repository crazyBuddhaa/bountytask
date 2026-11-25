/**
 * IMA SDK — complete a rewarded video ad session and credit the user.
 *
 * POST /api/ad-tasks/ima/complete
 * Body: { token: string }
 *
 * The token was issued by /api/ad-tasks/ima/start. This route:
 *  1. Validates the token signature and expiry
 *  2. Confirms the token's userId matches the authenticated user (prevents sharing)
 *  3. Re-checks the daily cap (protects against parallel tabs)
 *  4. Credits the ledger and sends an in-app notification
 *
 * The token itself is used as the session ID for deduplication — a replayed
 * token is caught by the unique index on ad_task_logs(provider, session_id).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createHash } from "crypto"
import {
  verifyImaToken,
  getAdProviderSettings,
} from "@/lib/ad-providers"
import { createNotification } from "@/lib/notifications"
import { recalcUserTier } from "@/lib/tiers"

export const dynamic = "force-dynamic"

const MIN_PLAYBACK_MS = 5000

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { token?: string }
  const { token } = body

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  // Validate token — checks HMAC signature, issuedAt, and 10-minute TTL
  const verified = verifyImaToken(token)
  if (!verified) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 })
  }

  // Token's userId must match the authenticated user
  if (verified.userId !== user.id) {
    return NextResponse.json({ error: "Token does not belong to this account" }, { status: 403 })
  }

  // Enforce minimum elapsed playback time
  if (Date.now() - verified.issuedAt < MIN_PLAYBACK_MS) {
    return NextResponse.json({ error: "Ad playback did not complete" }, { status: 403 })
  }

  const settings = await getAdProviderSettings()
  const ima = settings.ima

  if (!ima.enabled) {
    return NextResponse.json({ error: "IMA ads are not available" }, { status: 503 })
  }

  // Use a stable hash of the token as the session ID for deduplication
  const sessionId = createHash("sha256").update(token).digest("hex")

  // Look up user's tier daily limit
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

  // Atomic cap + tier limit + dedup + ad_task_logs + ledger credit
  const { data: rpcData, error: rpcErr } = await admin.rpc("claim_ad_reward", {
    p_user_id:          user.id,
    p_provider:         "ima",
    p_ad_type:          "video",
    p_reward_kobo:      ima.rewardKobo,
    p_session_id:       sessionId,
    p_note:             "Ad task reward — ima (video)",
    p_daily_cap:        ima.dailyCap,
    p_cooldown_seconds: 0,
    p_tier_daily_limit: tierDailyLimit,
  })

  if (rpcErr) {
    console.error("[ima/complete] claim_ad_reward error:", rpcErr)
    return NextResponse.json({ error: "Failed to process ad reward" }, { status: 500 })
  }

  const rpcRow = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as {
    ok: boolean
    reason: string
    retry_after: number
    daily_used: number
    tier_used: number
  } | null

  if (!rpcRow) {
    return NextResponse.json({ error: "Failed to process ad reward" }, { status: 500 })
  }

  if (!rpcRow.ok) {
    if (rpcRow.reason === "duplicate") {
      return NextResponse.json({ error: "This ad has already been credited" }, { status: 409 })
    }
    if (rpcRow.reason === "daily_cap") {
      return NextResponse.json({
        error: "Daily cap reached",
        cap: { used: rpcRow.daily_used, cap: ima.dailyCap },
      }, { status: 429 })
    }
    if (rpcRow.reason === "tier_limit") {
      return NextResponse.json({
        error: `You've reached your tier's daily task limit (${rpcRow.tier_used}/${tierDailyLimit}). Invite more friends or complete more tasks to unlock a higher limit, or try again tomorrow.`,
        code: "DAILY_LIMIT_REACHED",
      }, { status: 429 })
    }
    if (rpcRow.reason === "cooldown") {
      return NextResponse.json({ error: "Please wait before claiming another ad reward" }, { status: 429 })
    }
    return NextResponse.json({ error: "Unable to claim ad reward" }, { status: 400 })
  }

  const naira = (ima.rewardKobo / 100).toFixed(2)
  await Promise.allSettled([
    createNotification({
      userId:  user.id,
      type:    "task_approved",
      title:   "Ad Task Completed! 🎯",
      message: `₦${naira} credited for completing a video ad.`,
    }),
    recalcUserTier(user.id),
  ])

  return NextResponse.json({
    ok: true,
    rewardKobo: ima.rewardKobo,
    message: `₦${naira} credited to your balance!`,
  })
}
