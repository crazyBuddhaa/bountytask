import { NextResponse, type NextRequest } from "next/server"
import crypto from "node:crypto"
import { confirmVerificationPayment, confirmAdvertiserPayment } from "@/lib/paystack-confirm"
import { timingSafeStringEqual } from "@/lib/security"

export const dynamic = 'force-dynamic'

/**
 * Paystack webhook — the server-to-server half of payment confirmation.
 *
 * Why this exists: both /dashboard/verify and /advertise confirm payment by
 * having the browser call back into our API when Paystack redirects it home
 * after checkout. That works for the common case, but the customer's card
 * can be charged successfully and then the redirect never completes —
 * network drops, they close the tab, their browser/app crashes, they're on
 * a flaky connection. In that scenario the browser-driven route never runs,
 * and without this webhook the customer would be charged with no record of
 * it on our side.
 *
 * Paystack calls this URL directly from their servers the moment a charge
 * succeeds, independent of the customer's browser or network — so it's the
 * backstop that guarantees a real payment always gets recorded, even when
 * the client-side confirmation never fires. Configure this URL
 * (https://<your-domain>/api/webhooks/paystack) under Settings > API Keys &
 * Webhooks in the Paystack dashboard.
 *
 * Must read the raw body (not JSON-parsed) to verify the signature, per
 * Paystack's docs: https://paystack.com/docs/payments/webhooks/
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    console.error("[paystack webhook] PAYSTACK_SECRET_KEY is not configured")
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const rawBody = await request.text()

  const signature = request.headers.get("x-paystack-signature")
  const expectedSignature = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex")

  if (!signature || !timingSafeStringEqual(signature, expectedSignature)) {
    // Do not process — this request did not genuinely come from Paystack.
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let event: { event?: string; data?: { reference?: string; metadata?: Record<string, unknown> } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  // Always 200 for anything we don't act on, so Paystack doesn't retry
  // events we intentionally ignore (only charge.success needs handling here;
  // reference dedup already makes double-delivery of that event harmless).
  if (event?.event !== "charge.success") {
    return NextResponse.json({ received: true })
  }

  const reference = event.data?.reference as string | undefined
  const purpose = event.data?.metadata?.purpose as string | undefined
  if (!reference || !purpose) {
    return NextResponse.json({ received: true })
  }

  if (purpose === "withdrawal_verification_fee") {
    const userId = event.data?.metadata?.user_id as string | undefined
    if (!userId) return NextResponse.json({ received: true })
    const result = await confirmVerificationPayment(reference, userId)
    if (!result.ok) {
      // Log-worthy, but still 200: Paystack should not retry a payment that
      // genuinely failed our own validation (e.g. amount mismatch) — retrying
      // would never succeed and would just hammer this endpoint.
      console.error(`[paystack webhook] verification confirm failed for ${reference}:`, result.error)
    }
  } else if (purpose === "advertiser_submission_fee") {
    const submissionId = event.data?.metadata?.submission_id as string | undefined
    if (!submissionId) return NextResponse.json({ received: true })
    const result = await confirmAdvertiserPayment(reference, submissionId)
    if (!result.ok) {
      console.error(`[paystack webhook] advertiser confirm failed for ${reference}:`, result.error)
    }
  }

  return NextResponse.json({ received: true })
}
