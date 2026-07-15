/**
 * Ayet Studios offerwall postback endpoint.
 *
 * Ayet calls:
 *   GET /api/postback/ayet
 *     ?uid={external_identifier}   — your internal user ID (NOT Ayet's own user ID)
 *     &txn_id={transaction_id}     — unique per conversion; reversals reuse same ID
 *     &payout_usd={payout_usd}     — actual USD value; use this for NGN conversion
 *     &currency={currency_amount}  — virtual currency units (ignored — we use payout_usd)
 *     &chargeback={is_chargeback}  — "1" on reversal, "0" on normal completion
 *     &secret=STATIC_SECRET        — static token you control; set in Admin → Ayet Secret Key
 *
 * NOTE: Ayet offerwall postbacks carry NO HMAC signature. The `secret` query
 * param is a static token you append to the callback URL yourself (Admin Settings
 * → Ayet Studios → Secret Key). Reject any postback where it doesn't match.
 *
 * Respond HTTP 200 to confirm. Any non-200 triggers a retry from Ayet.
 *
 * Reversal handling:
 *   When chargeback=1, write a negative ledger entry (penalty) and deduplicate
 *   using session key `r-{txn_id}` so the original and its reversal are tracked
 *   independently. Daily cap and tier limits are NOT checked on reversals —
 *   a reversal must always succeed regardless of cap state.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAyetSettings, ayetUsdToKobo } from "@/lib/ayet"
import {
  isAdSessionDuplicate,
  checkAdDailyCap,
  recordAdCompletion,
} from "@/lib/ad-providers"
import { checkDailyTaskLimit } from "@/lib/tiers"
import { appendLedger } from "@/lib/ledger"
import { createAdminClient } from "@/lib/supabase/admin"
import { createNotification } from "@/lib/notifications"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())

  const userId       = params["uid"]        ?? ""
  const txnId        = params["txn_id"]     ?? ""
  const payoutUsd    = params["payout_usd"] ?? "0"
  const isChargeback = params["chargeback"] === "1"
  const secret       = params["secret"]     ?? ""

  if (!userId || !txnId) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 })
  }

  const settings = await getAyetSettings()
  if (!settings.enabled || !settings.placementKey) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 })
  }

  // Static secret check — the only auth mechanism for offerwall postbacks.
  // secretKey is the random token you appended to the callback URL in Ayet's dashboard.
  if (!settings.secretKey || secret !== settings.secretKey) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 })
  }

  const rewardKobo = ayetUsdToKobo(payoutUsd)

  // ── Chargeback / reversal ────────────────────────────────────────────────
  if (isChargeback) {
    const reversalSessionId = `r-${txnId}`

    // Idempotency — don't double-reverse
    if (await isAdSessionDuplicate("ayet", reversalSessionId)) {
      return NextResponse.json({ ok: true, duplicate: true })
    }

    const admin = createAdminClient()

    // Log the reversal row (negative reward) for cap/history queries
    const { error: logError } = await admin.from("ad_task_logs").insert({
      user_id:     userId,
      provider:    "ayet",
      ad_type:     "offer",
      reward_kobo: -rewardKobo,
      session_id:  reversalSessionId,
    })

    // 23505 = unique violation → already reversed; treat as success
    if (logError && logError.code !== "23505") {
      throw new Error(`ad_task_logs reversal insert failed: ${logError.message}`)
    }

    if (!logError) {
      // appendLedger normalises sign internally: type=debit → always negative delta
      await appendLedger({
        userId,
        type:    "debit",
        delta:   rewardKobo,
        refType: "penalty",
        note:    `Ayet Studios offer reversed (txn: ${txnId})`,
      })

      await createNotification({
        userId,
        type:    "general",
        title:   "Offer Reversed",
        message: `A previously credited offer was reversed by the advertiser. ₦${(rewardKobo / 100).toFixed(2)} has been deducted.`,
      })
    }

    return NextResponse.json({ ok: true })
  }

  // ── Normal completion ────────────────────────────────────────────────────

  // Idempotency
  if (await isAdSessionDuplicate("ayet", txnId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // Provider-level daily cap
  const cap = await checkAdDailyCap(userId, "ayet", settings.dailyCap)
  if (cap.limited) {
    return NextResponse.json({ error: "Daily cap reached" }, { status: 429 })
  }

  // Platform-wide tier daily limit (ads share the same budget as regular tasks)
  const tierLimit = await checkDailyTaskLimit(userId)
  if (tierLimit.limited) {
    return NextResponse.json({ error: "Daily platform limit reached" }, { status: 429 })
  }

  const result = await recordAdCompletion({
    userId,
    provider:    "ayet",
    adType:      "offer",
    rewardKobo,
    sessionId:   txnId,
  })

  if (result === null) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  return NextResponse.json({ ok: true })
}
