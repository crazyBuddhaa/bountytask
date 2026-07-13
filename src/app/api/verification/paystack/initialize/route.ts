import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getVerificationSettings } from "@/lib/verification"

export const dynamic = 'force-dynamic'

/**
 * Starts a Paystack redirect-based checkout for the withdrawal-verification
 * fee. Returns an `authorization_url` on Paystack's own domain for the
 * browser to navigate to — deliberately NOT the in-page inline.js/iframe
 * flow. That flow depends on a third-party script executing inside our page
 * and a checkout iframe reading its own storage, both of which browser
 * ad-blockers and third-party-cookie blocking silently break with no
 * recoverable error (see DEVLOG). A full-page redirect to Paystack's own
 * domain has neither dependency.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const settings = await getVerificationSettings()
  if (!settings.fee_enabled) {
    return NextResponse.json({ data: null, error: "Verification is not currently required." }, { status: 400 })
  }
  if (settings.payment_method !== "paystack") {
    return NextResponse.json({ data: null, error: "Paystack is not the configured payment method." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from("users").select("email, kyc_verified").eq("id", user.id).single()
  if (profile?.kyc_verified) {
    return NextResponse.json({ data: null, error: "You're already verified." }, { status: 409 })
  }

  const email = profile?.email ?? user.email
  if (!email) {
    return NextResponse.json({ data: null, error: "Could not determine your email. Refresh and try again." }, { status: 400 })
  }

  const reference = `verify_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: settings.fee_amount,
      currency: "NGN",
      reference,
      callback_url: `${request.nextUrl.origin}/dashboard/verify`,
      // user_id travels in metadata so the webhook (server-to-server,
      // no session) can still confirm this payment and flip kyc_verified
      // even if the browser never makes it back to callback_url.
      metadata: { purpose: "withdrawal_verification_fee", user_id: user.id },
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
