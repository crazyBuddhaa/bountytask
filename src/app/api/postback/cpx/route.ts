/**
 * CPX Research postback endpoint.
 *
 * CPX calls: GET /api/postback/cpx?ext_user_id={uid}&trans_id={tid}&status={1|2}&hash={md5}&payout={usd}
 *  status=1 → survey completed (credit user)
 *  status=2 → survey reversed / chargeback (acknowledge, no debit for now)
 *
 * Must respond with plain text "1" on success so CPX marks the postback delivered.
 * Respond with "0" (or any non-"1") to signal failure — CPX will retry.
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

  const userId    = searchParams.get("ext_user_id") ?? ""
  const transId   = searchParams.get("trans_id")    ?? ""
  const status    = searchParams.get("status")       ?? ""
  const hash      = searchParams.get("hash")         ?? ""
  const payout    = searchParams.get("payout")       ?? "0"

  // Validate required params
  if (!userId || !transId || !hash) {
    return new NextResponse("0", { status: 400, headers: { "Content-Type": "text/plain" } })
  }

  // Reversals — acknowledge without debiting (feature parity with ad networks)
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

  // Validate hash
  if (!validateCpxHash(settings.appId, userId, transId, settings.secureHashKey, hash)) {
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

  const rewardKobo = cpxUsdCentsToKobo(payout)

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
