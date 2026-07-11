import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const [profileResult, referralsResult, ledgerResult] = await Promise.all([
    admin.from("users").select("referral_code").eq("id", user.id).single(),
    admin
      .from("referrals")
      .select("id, referred_id, bonus_credited, bonus_amount, credited_at, created_at, referred:users!referred_id(full_name, username, created_at)")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("ledger")
      .select("delta")
      .eq("user_id", user.id)
      .eq("ref_type", "referral_bonus"),
  ])

  const referrals = referralsResult.data ?? []
  const totalEarned = (ledgerResult.data ?? []).reduce((sum, e) => sum + e.delta, 0)

  return NextResponse.json({
    data: {
      referral_code: profileResult.data?.referral_code,
      referral_url: `${process.env.NEXT_PUBLIC_APP_URL}/register?ref=${profileResult.data?.referral_code}`,
      total_referred: referrals.length,
      total_credited: referrals.filter(r => r.bonus_credited).length,
      total_earned_kobo: totalEarned,
      referrals,
    },
    error: null,
  })
}
