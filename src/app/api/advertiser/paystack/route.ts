import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdvertiserSettings } from "@/lib/advertiser"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const verifySchema = z.object({
  submission_id: z.string().uuid(),
  reference: z.string().min(4),
})

/** Public — confirms the advertiser submission fee, same verify-then-mark-paid pattern as withdrawal verification. */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const settings = await getAdvertiserSettings()
  if (!settings.submission_fee_enabled) {
    return NextResponse.json({ data: null, error: "A submission fee is not currently required." }, { status: 400 })
  }

  const { submission_id, reference } = parsed.data

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, cache: "no-store" }
  )
  const verifyJson = await verifyRes.json()

  if (!verifyRes.ok || !verifyJson.status || verifyJson.data?.status !== "success") {
    return NextResponse.json(
      { data: null, error: "Payment verification failed. Please try again or contact support." },
      { status: 402 }
    )
  }

  const paidAmount = verifyJson.data?.amount as number | undefined
  if (typeof paidAmount !== "number" || paidAmount < settings.submission_fee_kobo) {
    return NextResponse.json({ data: null, error: "Paid amount does not match the submission fee." }, { status: 400 })
  }

  const admin = createAdminClient()

  // This route is public and has no session to tie a reference to, so a real
  // successful reference could otherwise be replayed across many submission_ids
  // to mark them all "paid" from a single payment. idx_task_submissions_payment_reference_unique
  // is the atomic guard: only one submission can ever hold a given reference.
  const { data: existing } = await admin
    .from("task_submissions")
    .select("id")
    .eq("payment_reference", reference)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { data: null, error: "This payment reference has already been used." },
      { status: 409 }
    )
  }

  const { error } = await admin
    .from("task_submissions")
    .update({ payment_status: "paid", payment_reference: reference })
    .eq("id", submission_id)

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { data: null, error: "This payment reference has already been used." },
        { status: 409 }
      )
    }
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  await auditLog({
    action: "advertiser.submission.paystack.confirm",
    targetType: "task_submission",
    targetId: submission_id,
    details: { reference },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data: { paid: true }, error: null })
}
