import { createAdminClient } from "@/lib/supabase/admin"
import { getVerificationSettings } from "@/lib/verification"
import { getAdvertiserSettings } from "@/lib/advertiser"
import { auditLog } from "@/lib/audit"

/**
 * Shared, idempotent payment-confirmation logic used by BOTH:
 *  - the client-driven route the browser calls when Paystack redirects it
 *    back after checkout, and
 *  - the Paystack webhook (charge.success), which fires server-to-server
 *    independently of the customer's browser.
 *
 * This is what actually closes the "customer pays, network dies before the
 * redirect completes" gap: if the browser never makes it back, the webhook
 * still confirms the payment and flips the DB state on its own. Whichever of
 * the two arrives first does the work; the other is a no-op (see the 23505
 * handling below) rather than an error for the legitimate payer.
 *
 * Both call paths always re-verify against Paystack's own
 * /transaction/verify endpoint rather than trusting their caller's claim
 * that a reference succeeded — the webhook's payload is signature-verified
 * by its caller, but re-checking here means a forged/replayed reference can
 * never be enough on its own, from either path.
 */

type ConfirmResult = { ok: true; alreadyConfirmed: boolean } | { ok: false; error: string }

type PaystackVerifyResult =
  | {
      ok: true
      amount: number
      currency: string
      metadata: Record<string, unknown> | null
    }
  | { ok: false; error: string }

async function verifyWithPaystack(reference: string): Promise<PaystackVerifyResult> {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return { ok: false, error: "Payment service is not configured." }
  }
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, cache: "no-store" }
  )
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.status || json.data?.status !== "success") {
    return { ok: false, error: "Payment verification failed. Please try again or contact support." }
  }
  const amount = json.data?.amount as number | undefined
  if (typeof amount !== "number") {
    return { ok: false, error: "Payment verification returned no amount." }
  }
  const currency = typeof json.data?.currency === "string" ? json.data.currency.toUpperCase() : ""
  if (currency !== "NGN") {
    return { ok: false, error: "Unsupported payment currency." }
  }
  const metadata =
    json.data?.metadata && typeof json.data.metadata === "object"
      ? (json.data.metadata as Record<string, unknown>)
      : null
  return { ok: true, amount, currency, metadata }
}

/** Confirms the withdrawal-verification fee and marks the user kyc_verified. */
export async function confirmVerificationPayment(
  reference: string,
  userId: string
): Promise<ConfirmResult> {
  const settings = await getVerificationSettings()
  if (!settings.fee_enabled) {
    return { ok: false, error: "Verification is not currently required." }
  }

  const verified = await verifyWithPaystack(reference)
  if (!verified.ok) return { ok: false, error: verified.error }
  if (verified.currency !== "NGN") {
    return { ok: false, error: "Unsupported payment currency." }
  }
  if (
    verified.metadata?.purpose !== "withdrawal_verification_fee" ||
    verified.metadata?.user_id !== userId
  ) {
    return { ok: false, error: "Payment reference does not match this verification request." }
  }
  if (verified.amount < settings.fee_amount) {
    return { ok: false, error: "Paid amount does not match the verification fee." }
  }

  const admin = createAdminClient()

  // Global cross-flow deduplication prevents replaying a reference across flows or users
  const { error: globalClaimError } = await admin
    .from("paystack_consumed_references")
    .insert({
      reference,
      purpose: "withdrawal_verification_fee",
      entity_id: userId,
      user_id: userId,
      amount_kobo: verified.amount,
    })

  if (globalClaimError) {
    if (globalClaimError.code === "23505") {
      const { data: existing } = await admin
        .from("paystack_consumed_references")
        .select("purpose, entity_id")
        .eq("reference", reference)
        .maybeSingle()
      if (
        existing?.purpose === "withdrawal_verification_fee" &&
        existing?.entity_id === userId
      ) {
        return { ok: true, alreadyConfirmed: true }
      }
      return { ok: false, error: "Payment reference already used." }
    }
    return { ok: false, error: globalClaimError.message }
  }

  // Also record in legacy verification reference table for backwards compatibility
  const { error: claimError } = await admin
    .from("paystack_verification_references")
    .insert({ reference, user_id: userId })
  if (claimError && claimError.code !== "23505") {
    console.error("[paystack-confirm] legacy verification reference insert warning:", claimError.message)
  }

  const { error } = await admin.from("users").update({ kyc_verified: true }).eq("id", userId)
  if (error) return { ok: false, error: error.message }

  await auditLog({
    actorId: userId,
    action: "verification.paystack.approve",
    targetType: "user",
    targetId: userId,
    details: { reference },
  })

  return { ok: true, alreadyConfirmed: false }
}

/** Confirms an advertiser submission fee and marks the submission paid. */
export async function confirmAdvertiserPayment(
  reference: string,
  submissionId: string
): Promise<ConfirmResult> {
  const settings = await getAdvertiserSettings()
  if (!settings.submission_fee_enabled) {
    return { ok: false, error: "A submission fee is not currently required." }
  }

  const verified = await verifyWithPaystack(reference)
  if (!verified.ok) return { ok: false, error: verified.error }
  if (verified.currency !== "NGN") {
    return { ok: false, error: "Unsupported payment currency." }
  }
  if (
    verified.metadata?.purpose !== "advertiser_submission_fee" ||
    verified.metadata?.submission_id !== submissionId
  ) {
    return { ok: false, error: "Payment reference does not match this submission." }
  }
  if (verified.amount < settings.submission_fee_kobo) {
    return { ok: false, error: "Paid amount does not match the submission fee." }
  }

  const admin = createAdminClient()

  const { data: submission } = await admin
    .from("task_submissions")
    .select("id, payment_status")
    .eq("id", submissionId)
    .maybeSingle()
  if (!submission) return { ok: false, error: "Submission not found." }

  // Global cross-flow deduplication prevents replaying a reference across flows or submissions
  const { error: globalClaimError } = await admin
    .from("paystack_consumed_references")
    .insert({
      reference,
      purpose: "advertiser_submission_fee",
      entity_id: submissionId,
      user_id: null,
      amount_kobo: verified.amount,
    })

  if (globalClaimError) {
    if (globalClaimError.code === "23505") {
      const { data: existing } = await admin
        .from("paystack_consumed_references")
        .select("purpose, entity_id")
        .eq("reference", reference)
        .maybeSingle()
      if (
        existing?.purpose === "advertiser_submission_fee" &&
        existing?.entity_id === submissionId
      ) {
        return { ok: true, alreadyConfirmed: true }
      }
      return { ok: false, error: "Payment reference already used." }
    }
    return { ok: false, error: globalClaimError.message }
  }

  if (submission.payment_status === "paid") return { ok: true, alreadyConfirmed: true }

  const { error } = await admin
    .from("task_submissions")
    .update({ payment_status: "paid", payment_reference: reference })
    .eq("id", submissionId)

  if (error) {
    if (error.code === "23505") return { ok: true, alreadyConfirmed: true }
    return { ok: false, error: error.message }
  }

  await auditLog({
    action: "advertiser.submission.paystack.confirm",
    targetType: "task_submission",
    targetId: submissionId,
    details: { reference },
  })

  return { ok: true, alreadyConfirmed: false }
}
