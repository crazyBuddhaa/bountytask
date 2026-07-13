/**
 * Lootably postback endpoint.
 *
 * Lootably calls: GET /api/postback/lootably?user_id={uid}&transaction_id={tid}&reward={usd}&sig={hmac}
 * Signature: HMAC-SHA256(secret, userId + transactionId)
 *
 * Respond HTTP 200 to confirm delivery.
 */
import { NextRequest, NextResponse } from "next/server"
import { getLootablySettings, lootablyUsdToKobo } from "@/lib/lootably"
import {
  validateLootablySignature,
  isAdSessionDuplicate,
  checkAdDailyCap,
  recordAdCompletion,
} from "@/lib/ad-providers"
import { checkDailyTaskLimit } from "@/lib/tiers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const userId = searchParams.get("user_id")        ?? ""
  const txnId  = searchParams.get("transaction_id") ?? ""
  const reward = searchParams.get("reward")          ?? "0"
  const sig    = searchParams.get("sig")             ?? ""

  if (!userId || !txnId || !sig) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 })
  }

  const settings = await getLootablySettings()
  if (!settings.enabled || !settings.apiKey || !settings.secret) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 })
  }

  // Validate HMAC-SHA256 signature
  if (!validateLootablySignature(userId, txnId, settings.secret, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Idempotency
  if (await isAdSessionDuplicate("lootably", txnId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // Provider-specific daily cap
  const cap = await checkAdDailyCap(userId, "lootably", settings.dailyCap)
  if (cap.limited) {
    return NextResponse.json({ error: "Daily cap reached" }, { status: 429 })
  }

  // Platform-wide tier daily limit — tasks + ads share the same daily budget
  const tierLimit = await checkDailyTaskLimit(userId)
  if (tierLimit.limited) {
    return NextResponse.json({ error: "Daily platform limit reached" }, { status: 429 })
  }

  const rewardKobo = lootablyUsdToKobo(reward)

  const result = await recordAdCompletion({
    userId,
    provider: "lootably",
    adType: "mixed",
    rewardKobo,
    sessionId: txnId,
  })

  if (result === null) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  return NextResponse.json({ ok: true })
}
