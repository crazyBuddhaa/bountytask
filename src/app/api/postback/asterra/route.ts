/**
 * Asterra smartlink postback endpoint.
 *
 * Asterra calls:
 *   GET /api/postback/asterra
 *     ?uid={aff_sub}          — your internal user ID, passed as aff_sub on the click URL
 *     &txn_id={transaction_id} — Asterra's unique conversion ID; use as dedup key
 *     &payout_usd={payout}    — actual USD payout; converted to NGN at credit time
 *     &secret=STATIC_SECRET   — static token you control; set in Admin → Asterra Secret Key
 *
 * NOTE: Asterra smartlink postbacks carry no HMAC signature. The `secret` query
 * param is a static token you append to the postback URL yourself in Asterra's
 * dashboard. Reject any postback where it doesn't match.
 *
 * Configure the postback URL in Asterra's dashboard as:
 *   https://bountytask.dpdns.org/api/postback/asterra?uid={aff_sub}&txn_id={transaction_id}&payout_usd={payout}&secret=YOUR_SECRET
 *
 * Respond HTTP 200 to confirm. Any non-200 triggers a retry from Asterra.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAsterraSettings, asterraUsdToKobo } from "@/lib/asterra"
import {
  isAdSessionDuplicate,
  checkAdDailyCap,
  recordAdCompletion,
} from "@/lib/ad-providers"
import { checkDailyTaskLimit } from "@/lib/tiers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())

  const userId    = params["uid"]        ?? ""
  const txnId     = params["txn_id"]     ?? ""
  const payoutUsd = params["payout_usd"] ?? "0"
  const secret    = params["secret"]     ?? ""

  if (!userId || !txnId) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 })
  }

  const settings = await getAsterraSettings()
  if (!settings.enabled || !settings.smartlinkUrl) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 })
  }

  // Static secret check — the only auth mechanism for smartlink postbacks.
  if (!settings.secretKey || secret !== settings.secretKey) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 })
  }

  // Idempotency — don't double-credit replayed postbacks
  if (await isAdSessionDuplicate("asterra", txnId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // Provider-level daily cap
  const cap = await checkAdDailyCap(userId, "asterra", settings.dailyCap)
  if (cap.limited) {
    return NextResponse.json({ error: "Daily cap reached" }, { status: 429 })
  }

  // Platform-wide tier daily limit
  const tierLimit = await checkDailyTaskLimit(userId)
  if (tierLimit.limited) {
    return NextResponse.json({ error: "Daily platform limit reached" }, { status: 429 })
  }

  const rewardKobo = asterraUsdToKobo(payoutUsd)

  const result = await recordAdCompletion({
    userId,
    provider:  "asterra",
    adType:    "mixed",
    rewardKobo,
    sessionId: txnId,
  })

  if (result === null) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  return NextResponse.json({ ok: true })
}
