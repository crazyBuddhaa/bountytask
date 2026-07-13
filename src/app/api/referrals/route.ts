import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { REFERRAL_BONUS_KOBO, SIGNUP_BONUS_KOBO } from "@/lib/referrals"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const [profileResult, referralsResult, ledgerResult] = await Promise.all([
    admin.from("users").select("referral_code").eq("id", user.id).single(),
    admin
      .from("referrals")
      .select("id, referred_id, bonus_credited, bonus_amount, credited_at, created_at, referred:users!referred_id(full_name, username, created_at, kyc_verified)")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("ledger")
      .select("delta")
      .eq("user_id", user.id)
      .eq("ref_type", "referral_bonus"),
  ])

  // Build referral URL from request host so it works without NEXT_PUBLIC_APP_URL
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? ""
  const proto = request.headers.get("x-forwarded-proto") ?? "https"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `${proto}://${host}`
  const code = profileResult.data?.referral_code

  const referrals = referralsResult.data ?? []
  const totalEarned = (ledgerResult.data ?? []).reduce((sum, e) => sum + e.delta, 0)

  return NextResponse.json({
    data: {
      referral_code: code,
      referral_url: `${appUrl}/register?ref=${code}`,
      total_referred: referrals.length,
      total_credited: referrals.filter(r => r.bonus_credited).length,
      total_earned_kobo: totalEarned,
      referral_bonus_kobo: REFERRAL_BONUS_KOBO,
      signup_bonus_kobo: SIGNUP_BONUS_KOBO,
      referrals,
    },
    error: null,
  })
}
