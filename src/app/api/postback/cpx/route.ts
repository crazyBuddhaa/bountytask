/**
 * CPX Research postback endpoint.
 *
 * CPX calls this URL with the placeholders you configured in the dashboard.
 * Configure it as:
 *   GET /api/postback/cpx?user_id={user_id}&trans_id={trans_id}&status={status}&hash={secure_hash}&amount_usd={amount_usd}&amount_local={amount_local}
 *
 * Parameter notes (from CPX publisher dashboard):
 *  {user_id}      → the ext_user_id we passed in the iframe URL (echoed back)
 *  {trans_id}     → unique transaction ID for deduplication
 *  {status}       → 1 = completed, 2 = canceled/fraud chargeback
 *  {secure_hash}  → MD5(trans_id + '-' + secureHashKey)   ← NOT the widget hash
 *  {amount_usd}   → payout in USD dollars (e.g. "0.50")
 *  {amount_local} → payout in local currency — required by CPX but we use amount_usd
 *
 * Must respond with plain text "1" on success so CPX marks the postback delivered.
 * Respond with "0" (or any non-"1") to signal failure — CPX will retry.
 *
 * CPX postback IPs: 188.40.3.73, 157.90.97.92, 2a01:4f8:d0a:30ff::2
 */
import { NextRequest, NextResponse } from "next/server"
import { getCpxSettings, cpxUsdToKobo, validateCpxPostbackHash, CPX_POSTBACK_IPS } from "@/lib/cpx"
import {
  isAdSessionDuplicate,
  checkAdDailyCap,
  recordAdCompletion,
} from "@/lib/ad-providers"
import { appendLedger } from "@/lib/ledger"
import { flagUser } from "@/lib/fraud"
import { checkDailyTaskLimit } from "@/lib/tiers"
import { createAdminClient } from "@/lib/supabase/admin"
import { getClientIp } from "@/lib/utils"

export const dynamic = "force-dynamic"

function ok()  { return new NextResponse("1", { status: 200, headers: { "Content-Type": "text/plain" } }) }
function fail(status = 400) { return new NextResponse("0", { status, headers: { "Content-Type": "text/plain" } }) }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const userId    = searchParams.get("user_id")    ?? ""
  const transId   = searchParams.get("trans_id")   ?? ""
  const status    = searchParams.get("status")     ?? ""
  const hash      = searchParams.get("hash")       ?? ""
  const amountUsd = searchParams.get("amount_usd") ?? "0"

  // ── IP allowlist (optional but recommended) ─────────────────────────────────
  // Only CPX's known server IPs should ever be posting to this endpoint.
  // We log unexpected IPs rather than hard-reject, because CPX may add new IPs
  // without notice — hard-rejecting would silently drop real postbacks.
  const callerIp = getClientIp(request.headers)
  if (callerIp && !CPX_POSTBACK_IPS.includes(callerIp)) {
    console.warn(`[cpx-postback] unexpected source IP: ${callerIp} — processing anyway`)
  }

  // ── Required params ─────────────────────────────────────────────────────────
  if (!userId || !transId) {
    console.error("[cpx-postback] missing user_id or trans_id", { userId, transId })
    return fail(400)
  }
  if (!hash) {
    console.error("[cpx-postback] missing hash param", { transId })
    return fail(401)
  }

  // ── Load settings ───────────────────────────────────────────────────────────
  const settings = await getCpxSettings()
  if (!settings.enabled || !settings.appId || !settings.secureHashKey) {
    console.error("[cpx-postback] CPX not configured or disabled")
    return fail(503)
  }

  // ── Validate hash: MD5(trans_id + '-' + secureHashKey) ─────────────────────
  // Verified for BOTH status=1 (credit) and status=2 (chargeback/reversal).
  if (!validateCpxPostbackHash(transId, settings.secureHashKey, hash)) {
    console.error("[cpx-postback] hash mismatch", { transId })
    return fail(401)
  }

  const admin = createAdminClient()

  // ── status=2 → canceled/fraud chargeback reversal ──────────────────────────
  if (status === "2") {
    const { data: originalLog } = await admin
      .from("ad_task_logs")
      .select("id, user_id, reward_kobo")
      .eq("provider", "cpx")
      .eq("session_id", transId)
      .maybeSingle()

    if (originalLog && originalLog.reward_kobo > 0) {
      // Idempotency: ensure we only debit once per original transaction
      const { data: existingReversal } = await admin
        .from("ledger")
        .select("id")
        .eq("ref_type", "penalty")
        .eq("ref_id", originalLog.id)
        .limit(1)
        .maybeSingle()

      if (!existingReversal) {
        try {
          await appendLedger({
            userId: originalLog.user_id,
            type: "debit",
            delta: originalLog.reward_kobo,
            refType: "penalty",
            refId: originalLog.id,
            note: `CPX survey chargeback reversal (trans_id: ${transId})`,
          })
          await flagUser({
            userId: originalLog.user_id,
            reason: "CPX survey chargeback / reversal",
            severity: "medium",
            details: { transId, rewardKobo: originalLog.reward_kobo },
          })
          console.warn("[cpx-postback] chargeback reversed", {
            userId: originalLog.user_id,
            transId,
            rewardKobo: originalLog.reward_kobo,
          })
        } catch (err) {
          console.error("[cpx-postback] chargeback reversal failed", { transId, err })
          return fail(500)
        }
      }
    }
    return ok()
  }

  // ── Only credit on status=1 (completed) ─────────────────────────────────────
  if (status !== "1") return ok()

  // ── Verify the user_id maps to a real user ──────────────────────────────────
  // The user_id is NOT part of the CPX hash, so a MITM could swap it.
  // Checking existence prevents credits landing on phantom or unknown accounts.
  const { data: userRow, error: userErr } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .single()

  if (userErr || !userRow) {
    console.error("[cpx-postback] unknown user_id", { userId, transId })
    // Return "1" so CPX doesn't retry — this transaction genuinely has no target.
    return ok()
  }

  // ── Idempotency — already credited? ────────────────────────────────────────
  if (await isAdSessionDuplicate("cpx", transId)) {
    return ok()
  }

  // ── Provider-specific daily cap ─────────────────────────────────────────────
  const cap = await checkAdDailyCap(userId, "cpx", settings.dailyCap)
  if (cap.limited) {
    console.info("[cpx-postback] daily cap reached", { userId, used: cap.used, cap: cap.cap })
    return fail(429)
  }

  // ── Platform-wide tier daily limit ─────────────────────────────────────────
  const tierLimit = await checkDailyTaskLimit(userId)
  if (tierLimit.limited) {
    console.info("[cpx-postback] tier limit reached", { userId, used: tierLimit.used, limit: tierLimit.limit })
    return fail(429)
  }

  // ── Credit the user ─────────────────────────────────────────────────────────
  const rewardKobo = cpxUsdToKobo(amountUsd, settings.userSharePercent)
  if (rewardKobo <= 0) {
    console.warn("[cpx-postback] non-positive reward amount — ignoring", { userId, transId, amountUsd })
    return ok()
  }

  try {
    const result = await recordAdCompletion({
      userId,
      provider: "cpx",
      adType: "survey",
      rewardKobo,
      sessionId: transId,
    })

    if (result === null) {
      // Duplicate insert caught at DB level — treat as already processed.
      return ok()
    }

    console.info("[cpx-postback] credited", { userId, transId, rewardKobo, amountUsd })
    return ok()
  } catch (err) {
    console.error("[cpx-postback] recordAdCompletion failed", { userId, transId, err })
    return fail(500)
  }
}
