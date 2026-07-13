import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdvertiserSettings } from "@/lib/advertiser"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({
  submission_id: z.string().uuid(),
})

/**
 * Starts a Paystack redirect-based checkout for the advertiser submission
 * fee. See src/app/api/verification/paystack/initialize/route.ts for the
 * full rationale for redirecting to Paystack's own domain instead of using
 * the in-page inline.js/iframe flow.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { submission_id } = parsed.data

  const settings = await getAdvertiserSettings()
  if (!settings.submission_fee_enabled) {
    return NextResponse.json({ data: null, error: "A submission fee is not currently required." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: submission } = await admin
    .from("task_submissions")
    .select("id, payment_status, contact_email")
    .eq("id", submission_id)
    .maybeSingle()
  if (!submission) {
    return NextResponse.json({ data: null, error: "Submission not found." }, { status: 404 })
  }
  if (submission.payment_status === "paid") {
    return NextResponse.json({ data: null, error: "This submission has already been paid for." }, { status: 409 })
  }
  const email = submission.contact_email
  if (!email) {
    return NextResponse.json({ data: null, error: "This submission has no contact email on file." }, { status: 400 })
  }

  const reference = `advertiser_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: settings.submission_fee_kobo,
      currency: "NGN",
      reference,
      // submission_id travels round-trip in the callback URL's query string —
      // Paystack preserves it and appends its own `reference`/`trxref` params
      // alongside it when redirecting back.
      callback_url: `${request.nextUrl.origin}/advertise?submission_id=${encodeURIComponent(submission_id)}`,
      metadata: { purpose: "advertiser_submission_fee", submission_id },
    }),
  })
  const initJson = await initRes.json().catch(() => null)

  if (!initRes.ok || !initJson?.status || !initJson.data?.authorization_url) {
    return NextResponse.json(
      { data: null, error: initJson?.message ?? "Could not start payment. Try again." },
      { status: 502 }
    )
  }

  return NextResponse.json({
    data: { authorization_url: initJson.data.authorization_url as string, reference },
    error: null,
  })
}
