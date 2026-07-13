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

async function verifyWithPaystack(reference: string): Promise<
  { ok: true; amount: number } | { ok: false; error: string }
> {
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
  return { ok: true, amount }
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
  if (verified.amount < settings.fee_amount) {
    return { ok: false, error: "Paid amount does not match the verification fee." }
  }

  const admin = createAdminClient()

  const { error: claimError } = await admin
    .from("paystack_verification_references")
    .insert({ reference, user_id: userId })

  if (claimError) {
    if (claimError.code === "23505") {
      // Reference already claimed — by whichever of (webhook, browser
      // redirect) got here first. Check who claimed it: same user means the
      // other path already finished this exact payment, so this is a benign
      // race, not a replay attempt.
      const { data: existing } = await admin
        .from("paystack_verification_references")
        .select("user_id")
        .eq("reference", reference)
        .maybeSingle()
      if (existing?.user_id === userId) {
        return { ok: true, alreadyConfirmed: true }
      }
      return { ok: false, error: "This payment reference has already been used." }
    }
    return { ok: false, error: claimError.message }
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
  if (verified.amount < settings.submission_fee_kobo) {
    return { ok: false, error: "Paid amount does not match the submission fee." }
  }

  const admin = createAdminClient()

  const { data: existingByRef } = await admin
    .from("task_submissions")
    .select("id")
    .eq("payment_reference", reference)
    .maybeSingle()
  if (existingByRef) {
    return existingByRef.id === submissionId
      ? { ok: true, alreadyConfirmed: true }
      : { ok: false, error: "This payment reference has already been used." }
  }

  const { data: submission } = await admin
    .from("task_submissions")
    .select("id, payment_status")
    .eq("id", submissionId)
    .maybeSingle()
  if (!submission) return { ok: false, error: "Submission not found." }
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
