/**
 * AdGate Media postback endpoint.
 *
 * AdGate calls: GET /api/postback/adgate?conversion_id={id}&user_id={s1}&payout={usd}&state={state}&offer_id={id}&offer_name={name}
 * (macro names configured in the wall's Postback field on the AdGate panel)
 *
 * Unlike Lootably/CPX, AdGate does not sign postbacks with a hash —
 * it verifies by source IP instead. The IP shown on your affiliate panel
 * under the wall's Postback section must be saved in admin settings.
 *
 * Respond with HTTP 200 to confirm delivery.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAdGateSettings, adgateUsdToKobo } from "@/lib/adgate"
import {
  validateAdGatePostbackIp,
  isAdSessionDuplicate,
  checkAdDailyCap,
  recordAdCompletion,
} from "@/lib/ad-providers"
import { checkDailyTaskLimit } from "@/lib/tiers"
import { getClientIp } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const userId       = searchParams.get("user_id")       ?? ""
  const conversionId = searchParams.get("conversion_id") ?? ""
  const payout       = searchParams.get("payout")         ?? "0"
  // AdGate only sends postbacks for "approved" conversions unless the
  // {state} macro is present — reject anything else (rejected/pending/reversal).
  const state         = searchParams.get("state") ?? "approved"

  if (!userId || !conversionId) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 })
  }

  const settings = await getAdGateSettings()
  if (!settings.enabled || !settings.wallId || !settings.postbackIp) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 })
  }

  const requestIp = getClientIp(request.headers)
  if (!validateAdGatePostbackIp(requestIp, settings.postbackIp)) {
    return NextResponse.json({ error: "Untrusted source IP" }, { status: 401 })
  }

  if (state !== "approved") {
    // Reversal/rejection notice — nothing to credit. Acknowledge so AdGate
    // doesn't keep retrying, but don't touch ad_task_logs or the ledger.
    return NextResponse.json({ ok: true, ignored: state })
  }

  // Idempotency
  if (await isAdSessionDuplicate("adgate", conversionId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // Provider-specific daily cap
  const cap = await checkAdDailyCap(userId, "adgate", settings.dailyCap)
  if (cap.limited) {
    return NextResponse.json({ error: "Daily cap reached" }, { status: 429 })
  }

  // Platform-wide tier daily limit — tasks + ads share the same daily budget
  const tierLimit = await checkDailyTaskLimit(userId)
  if (tierLimit.limited) {
    return NextResponse.json({ error: "Daily platform limit reached" }, { status: 429 })
  }

  const rewardKobo = adgateUsdToKobo(payout)

  const result = await recordAdCompletion({
    userId,
    provider: "adgate",
    adType: "offer",
    rewardKobo,
    sessionId: conversionId,
  })

  if (result === null) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  return NextResponse.json({ ok: true })
}
