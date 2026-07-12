import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getVerificationSettings } from "@/lib/verification"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({
  payment_reference: z.string().min(1, "Enter your transfer reference"),
})

/**
 * Submits a bank-transfer verification request for the currently signed-in
 * user (fee gates withdrawals, not signup). Admin reviews it under
 * /admin/pending-verifications and approving just flips kyc_verified — no
 * account is created here.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const settings = await getVerificationSettings()
  if (!settings.fee_enabled) {
    return NextResponse.json({ data: null, error: "Verification is not currently required." }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin.from("users").select("full_name, email, kyc_verified").eq("id", user.id).single()
  if (profile?.kyc_verified) {
    return NextResponse.json({ data: null, error: "You're already verified." }, { status: 409 })
  }

  const { data: pending } = await admin
    .from("pending_verifications")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle()
  if (pending) {
    return NextResponse.json(
      { data: null, error: "A verification request is already pending admin review." },
      { status: 409 }
    )
  }

  const { error } = await admin.from("pending_verifications").insert({
    user_id: user.id,
    full_name: profile?.full_name ?? "Unknown",
    email: (profile?.email ?? user.email ?? "").toLowerCase(),
    payment_reference: parsed.data.payment_reference,
    payment_method: "bank_transfer",
    status: "pending",
  })

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to submit request. Try again." }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true }, error: null })
}
