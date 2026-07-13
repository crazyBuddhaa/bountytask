import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

/**
 * GET /api/referrals/validate?code=XXX
 * Returns { valid: boolean } — whether the code belongs to an existing user.
 * Does not require authentication (called from the public register page).
 */
export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase()
  if (!code || code.length < 4) {
    return NextResponse.json({ valid: false })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from("users")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle()

  return NextResponse.json({ valid: !!data })
}
