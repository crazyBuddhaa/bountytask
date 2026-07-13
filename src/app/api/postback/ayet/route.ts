/**
 * Ayet Studios postback endpoint.
 *
 * Ayet calls: GET /api/postback/ayet?uid={userId}&txn_id={txnId}&reward={usd}&sig={hmac}&...
 * The signature is HMAC-SHA256 over all params (excluding `sig`), sorted alphabetically,
 * joined as `key=value&key=value`, signed with the secret key.
 *
 * Respond with HTTP 200 to confirm delivery. Any non-200 triggers a retry.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAyetSettings, ayetUsdToKobo } from "@/lib/ayet"
import {
  validateAyetSignature,
  isAdSessionDuplicate,
  checkAdDailyCap,
  recordAdCompletion,
} from "@/lib/ad-providers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())

  const userId = params["uid"]    ?? ""
  const txnId  = params["txn_id"] ?? ""
  const reward = params["reward"] ?? "0"

  if (!userId || !txnId) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 })
  }

  const settings = await getAyetSettings()
  if (!settings.enabled || !settings.placementKey || !settings.secretKey) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 })
  }

  // Validate HMAC-SHA256 signature
  if (!validateAyetSignature(params, settings.secretKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Idempotency
  if (await isAdSessionDuplicate("ayet", txnId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // Daily cap
  const cap = await checkAdDailyCap(userId, "ayet", settings.dailyCap)
  if (cap.limited) {
    return NextResponse.json({ error: "Daily cap reached" }, { status: 429 })
  }

  const rewardKobo = ayetUsdToKobo(reward)

  const result = await recordAdCompletion({
    userId,
    provider: "ayet",
    adType: "offer",
    rewardKobo,
    sessionId: txnId,
  })

  if (result === null) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  return NextResponse.json({ ok: true })
}
