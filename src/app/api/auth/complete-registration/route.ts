import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { creditSignupBonus, processReferral } from "@/lib/referrals"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({
  reference:     z.string().min(1),
  full_name:     z.string().min(2).max(80),
  email:         z.string().email(),
  password:      z.string().min(8),
  referral_code: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { reference, full_name, email, password, referral_code } = parsed.data

  // 1. Verify payment with Paystack
  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      cache: "no-store",
    }
  )
  const verifyJson = await verifyRes.json()

  if (!verifyRes.ok || !verifyJson.status || verifyJson.data?.status !== "success") {
    return NextResponse.json(
      { data: null, error: "Payment verification failed. Please try again or contact support." },
      { status: 402 }
    )
  }

  // 2. Confirm the payment was made with the correct email
  const paidEmail = (verifyJson.data?.customer?.email ?? "").toLowerCase()
  if (paidEmail !== email.toLowerCase()) {
    return NextResponse.json(
      { data: null, error: "Payment email does not match registration email." },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // 3. Ensure no duplicate account
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { data: null, error: "An account with this email already exists. Please sign in." },
      { status: 409 }
    )
  }

  // 4. Create Supabase auth user (email auto-confirmed — they paid)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, referral_code },
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { data: null, error: authError?.message ?? "Account creation failed." },
      { status: 500 }
    )
  }

  const userId = authData.user.id

  // 5. Credit signup bonus & process referral
  try { await creditSignupBonus(userId) } catch {}
  if (referral_code) {
    try { await processReferral(userId, referral_code) } catch {}
  }

  return NextResponse.json({ data: { success: true }, error: null })
}
