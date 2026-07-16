import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { creditSignupBonusIfNew } from "@/lib/referrals"
import { sendWelcomeEmail } from "@/lib/notifications"
import { z } from "zod"

export const dynamic = "force-dynamic"

const schema = z.object({
  user_id: z.string().uuid(),
  referral_code: z.string().optional(),
})

/**
 * Credits the welcome bonus immediately after `supabase.auth.signUp()`
 * succeeds on the client, regardless of whether the project requires
 * email confirmation. Previously the bonus only landed once a user
 * clicked their confirmation email link and passed through
 * /api/auth/callback — if "Confirm email" was off (or the email never
 * arrived), the ledger entry was never created.
 *
 * Idempotent and safe to call more than once: creditSignupBonusIfNew
 * only credits a user with zero existing ledger entries.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { user_id, referral_code } = parsed.data

  // Make sure this is a real auth user before crediting anything.
  const admin = createAdminClient()
  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(user_id)
  if (authError || !authUser?.user) {
    return NextResponse.json({ data: null, error: "Unknown user." }, { status: 404 })
  }

  try {
    const result = await creditSignupBonusIfNew(user_id, referral_code)

    // Send welcome email on first-time signup (creditSignupBonusIfNew is a
    // no-op for existing users, so `credited` being true means new user).
    if (result?.credited) {
      const name =
        (authUser.user.user_metadata?.full_name as string | undefined) ??
        (authUser.user.email?.split("@")[0] ?? "there")
      sendWelcomeEmail(authUser.user.email ?? "", name).catch((e) =>
        console.error("Welcome email failed:", e)
      )
    }

    return NextResponse.json({ data: result, error: null })
  } catch (e) {
    return NextResponse.json(
      { data: null, error: e instanceof Error ? e.message : "Failed to credit signup bonus." },
      { status: 500 }
    )
  }
}
