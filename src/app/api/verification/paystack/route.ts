import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getVerificationSettings } from "@/lib/verification"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({ reference: z.string().min(1) })

/**
 * Confirms a Paystack payment for the one-time withdrawal-verification fee
 * and marks the currently signed-in user as kyc_verified. Unlike the old
 * registration-time flow, this never creates an account — the user is
 * already signed in.
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

  const { reference } = parsed.data

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

  const paidAmount = verifyJson.data?.amount as number | undefined
  if (typeof paidAmount !== "number" || paidAmount < settings.fee_amount) {
    return NextResponse.json(
      { data: null, error: "Paid amount does not match the verification fee." },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { error } = await admin.from("users").update({ kyc_verified: true }).eq("id", user.id)
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({
    actorId: user.id,
    action: "verification.paystack.approve",
    targetType: "user",
    targetId: user.id,
    details: { reference },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data: { verified: true }, error: null })
}
