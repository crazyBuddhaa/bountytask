import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { creditSignupBonusIfNew } from "@/lib/referrals"
import { sendWelcomeEmail } from "@/lib/notifications"
import { z } from "zod"

export const dynamic = "force-dynamic"

const schema = z.object({
  user_id: z.string().uuid().optional(),
  referral_code: z.string().optional(),
})

/**
 * Credits the welcome bonus immediately after `supabase.auth.signUp()`
 * succeeds on the client when a session is active. Always derives the
 * target user from the authenticated session (never trusting arbitrary
 * caller-supplied user IDs).
 *
 * Idempotent and safe to call more than once: creditSignupBonusIfNew
 * only credits a user with zero existing ledger entries and handles
 * unique-constraint races gracefully.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { user_id, referral_code } = parsed.data
  if (user_id && user_id !== user.id) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  try {
    const result = await creditSignupBonusIfNew(user.id, referral_code)

    // Send welcome email on first-time signup (creditSignupBonusIfNew is a
    // no-op for existing users, so `credited` being true means new user).
    if (result?.credited) {
      const name =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.email?.split("@")[0] ?? "there")
      sendWelcomeEmail(user.email ?? "", name).catch((e) =>
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
