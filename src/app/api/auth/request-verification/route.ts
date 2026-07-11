import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({
  full_name:         z.string().min(2).max(80),
  email:             z.string().email(),
  referral_code:     z.string().optional(),
  payment_reference: z.string().min(1, "Enter your bank transfer reference"),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { full_name, email, referral_code, payment_reference } = parsed.data
  const admin = createAdminClient()

  // Check no existing account
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { data: null, error: "An account with this email already exists." },
      { status: 409 }
    )
  }

  // Check not already pending
  const { data: pending } = await admin
    .from("pending_verifications")
    .select("id, status")
    .eq("email", email.toLowerCase())
    .maybeSingle()
  if (pending) {
    const msg = pending.status === "rejected"
      ? "Your previous request was rejected. Contact support."
      : "A verification request for this email is already pending admin review."
    return NextResponse.json({ data: null, error: msg }, { status: 409 })
  }

  const { error } = await admin.from("pending_verifications").insert({
    full_name,
    email: email.toLowerCase(),
    referral_code: referral_code || null,
    payment_reference,
    payment_method: "bank_transfer",
    status: "pending",
  })

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to submit request. Try again." }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true }, error: null })
}
