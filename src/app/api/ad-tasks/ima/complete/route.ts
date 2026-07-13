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
import { createHash } from "crypto"
import {
  validateImaToken,
  getAdProviderSettings,
  checkAdDailyCap,
  recordAdCompletion,
  isAdSessionDuplicate,
} from "@/lib/ad-providers"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { token?: string }
  const { token } = body

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
  }

  // Validate token — checks HMAC signature and 10-minute TTL
  const tokenUserId = validateImaToken(token)
  if (!tokenUserId) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 })
  }

  // Token's userId must match the authenticated user
  if (tokenUserId !== user.id) {
    return NextResponse.json({ error: "Token does not belong to this account" }, { status: 403 })
  }

  // Use a stable hash of the token as the session ID for deduplication
  const sessionId = createHash("sha256").update(token).digest("hex")

  // Idempotency — has this exact token already been redeemed?
  if (await isAdSessionDuplicate("ima", sessionId)) {
    return NextResponse.json({ error: "This ad has already been credited" }, { status: 409 })
  }

  const settings = await getAdProviderSettings()
  const ima = settings.ima

  if (!ima.enabled) {
    return NextResponse.json({ error: "IMA ads are not available" }, { status: 503 })
  }

  // Re-check daily cap (race condition guard: two tabs both started within the cap)
  const cap = await checkAdDailyCap(user.id, "ima", ima.dailyCap)
  if (cap.limited) {
    return NextResponse.json({
      error: "Daily cap reached",
      cap: { used: cap.used, cap: cap.cap },
    }, { status: 429 })
  }

  const result = await recordAdCompletion({
    userId: user.id,
    provider: "ima",
    adType: "video",
    rewardKobo: ima.rewardKobo,
    sessionId,
  })

  if (result === null) {
    return NextResponse.json({ error: "Already credited" }, { status: 409 })
  }

  const naira = (ima.rewardKobo / 100).toFixed(2)
  return NextResponse.json({
    ok: true,
    rewardKobo: ima.rewardKobo,
    message: `₦${naira} credited to your balance!`,
  })
}
