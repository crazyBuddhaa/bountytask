/**
 * CPX Research postback endpoint.
 *
 * CPX calls this URL with the placeholders you configured in the dashboard.
 * We configure it as:
 *   GET /api/postback/cpx?user_id={user_id}&trans_id={trans_id}&status={status}&hash={secure_hash}&amount_usd={amount_usd}
 *
 * Parameter notes (from CPX publisher dashboard):
 *  {user_id}      → the ext_user_id we passed in the iframe URL (echoed back)
 *  {trans_id}     → unique transaction ID for deduplication
 *  {status}       → 1 = completed, 2 = canceled/fraud chargeback
 *  {secure_hash}  → MD5(trans_id + '-' + secureHashKey)
 *  {amount_usd}   → payout in USD (e.g. "0.50")
 *
 * Must respond with plain text "1" on success so CPX marks the postback delivered.
 * Respond with "0" (or any non-"1") to signal failure — CPX will retry.
 *
 * CPX postback IPs: 188.40.3.73, 2a01:4f8:d0a:30ff::2, 157.90.97.92
 */
import { NextRequest, NextResponse } from "next/server"
import { getCpxSettings, cpxUsdCentsToKobo } from "@/lib/cpx"
import {
  validateCpxHash,
  isAdSessionDuplicate,
  checkAdDailyCap,
  recordAdCompletion,
} from "@/lib/ad-providers"
import { checkDailyTaskLimit } from "@/lib/tiers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const userId    = searchParams.get("user_id")    ?? ""
  const transId   = searchParams.get("trans_id")   ?? ""
  const status    = searchParams.get("status")      ?? ""
  const hash      = searchParams.get("hash")        ?? ""
  const amountUsd = searchParams.get("amount_usd") ?? "0"

  // Validate required params
  if (!userId || !transId || !hash) {
    return new NextResponse("0", { status: 400, headers: { "Content-Type": "text/plain" } })
  }

  // status=2 → canceled/fraud. Acknowledge without debiting.
  if (status === "2") {
    return new NextResponse("1", { status: 200, headers: { "Content-Type": "text/plain" } })
  }

  // Only credit on status=1 (completed)
  if (status !== "1") {
    return new NextResponse("1", { status: 200, headers: { "Content-Type": "text/plain" } })
  }

  const settings = await getCpxSettings()
  if (!settings.enabled || !settings.appId || !settings.secureHashKey) {
    return new NextResponse("0", { status: 503, headers: { "Content-Type": "text/plain" } })
  }

  // Validate hash: MD5(trans_id + '-' + secureHashKey)
  if (!validateCpxHash(transId, settings.secureHashKey, hash)) {
    return new NextResponse("0", { status: 401, headers: { "Content-Type": "text/plain" } })
  }

  // Idempotency — already credited?
  if (await isAdSessionDuplicate("cpx", transId)) {
    return new NextResponse("1", { status: 200, headers: { "Content-Type": "text/plain" } })
  }

  // Provider-specific daily cap
  const cap = await checkAdDailyCap(userId, "cpx", settings.dailyCap)
  if (cap.limited) {
    return new NextResponse("0", { status: 429, headers: { "Content-Type": "text/plain" } })
  }

  // Platform-wide tier daily limit — tasks + ads share the same daily budget
  const tierLimit = await checkDailyTaskLimit(userId)
  if (tierLimit.limited) {
    return new NextResponse("0", { status: 429, headers: { "Content-Type": "text/plain" } })
  }

  const rewardKobo = cpxUsdCentsToKobo(amountUsd)

  const result = await recordAdCompletion({
    userId,
    provider: "cpx",
    adType: "survey",
    rewardKobo,
    sessionId: transId,
  })

  // result=null means duplicate insert caught at DB level — still success
  if (result === null) {
    return new NextResponse("1", { status: 200, headers: { "Content-Type": "text/plain" } })
  }

  return new NextResponse("1", { status: 200, headers: { "Content-Type": "text/plain" } })
}
