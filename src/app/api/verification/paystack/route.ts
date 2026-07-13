import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { confirmVerificationPayment } from "@/lib/paystack-confirm"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({ reference: z.string().min(1) })

/**
 * Confirms a Paystack payment for the one-time withdrawal-verification fee
 * and marks the currently signed-in user as kyc_verified. Unlike the old
 * registration-time flow, this never creates an account — the user is
 * already signed in.
 *
 * This is the client-driven half of confirmation: the browser calls it when
 * Paystack redirects back after checkout. It's deliberately NOT the only way
 * a payment gets confirmed — see /api/webhooks/paystack for the
 * server-to-server half, which covers the case where the customer is
 * charged but the browser never makes it back here (dropped connection,
 * closed tab, crashed app, etc). Both paths share confirmVerificationPayment,
 * which is idempotent, so whichever arrives first does the work and the
 * other is a no-op.
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

  const result = await confirmVerificationPayment(parsed.data.reference, user.id)
  if (!result.ok) {
    return NextResponse.json({ data: null, error: result.error }, { status: 402 })
  }

  return NextResponse.json({ data: { verified: true }, error: null })
}
