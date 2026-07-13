/**
 * HideoutTV postback endpoint.
 *
 * HideoutTV calls: GET /api/postback/hideout?user_id={uid}&session_id={sid}&sig={hmac}&...
 * Signature: HMAC-SHA256(secret, userId + sessionId)
 *
 * Reward is platform-configured (stored in hideout_reward_kobo) since HideoutTV
 * pays per qualifying session at a negotiated rate, not variable per-view.
 *
 * Respond HTTP 200 to confirm delivery.
 */
import { NextRequest, NextResponse } from "next/server"
import { getHideoutSettings } from "@/lib/hideout"
import {
  validateHideoutSignature,
  isAdSessionDuplicate,
  checkAdDailyCap,
  recordAdCompletion,
} from "@/lib/ad-providers"
import { checkDailyTaskLimit } from "@/lib/tiers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const userId    = searchParams.get("user_id")    ?? ""
  const sessionId = searchParams.get("session_id") ?? ""
  const sig       = searchParams.get("sig")        ?? ""

  if (!userId || !sessionId || !sig) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 })
  }

  const settings = await getHideoutSettings()
  if (!settings.enabled || !settings.publisherId || !settings.secret) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 })
  }

  // Validate HMAC-SHA256 signature
  if (!validateHideoutSignature(userId, sessionId, settings.secret, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Idempotency
  if (await isAdSessionDuplicate("hideout", sessionId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // Provider-specific daily cap
  const cap = await checkAdDailyCap(userId, "hideout", settings.dailyCap)
  if (cap.limited) {
    return NextResponse.json({ error: "Daily cap reached" }, { status: 429 })
  }

  // Platform-wide tier daily limit — tasks + ads share the same daily budget
  const tierLimit = await checkDailyTaskLimit(userId)
  if (tierLimit.limited) {
    return NextResponse.json({ error: "Daily platform limit reached" }, { status: 429 })
  }

  const result = await recordAdCompletion({
    userId,
    provider: "hideout",
    adType: "video",
    rewardKobo: settings.rewardKobo,
    sessionId,
  })

  if (result === null) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  return NextResponse.json({ ok: true })
}
