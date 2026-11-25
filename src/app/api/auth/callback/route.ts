import { createClient } from "@/lib/supabase/server";
import { creditSignupBonusIfNew } from "@/lib/referrals";
import { sanitizeRedirectPath } from "@/lib/security";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirectPath(searchParams.get("next"));
  const baseUrl =
    process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")
      : origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const userId = data.user.id;

      // Idempotent — no-ops if this user already has a ledger entry
      // (e.g. the bonus was already credited right after signup).
      const referralCode =
        data.user.user_metadata?.referral_code as string | undefined;
      try {
        await creditSignupBonusIfNew(userId, referralCode);
      } catch (e) {
        console.error("Signup bonus error:", e);
      }

      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/sign-in?error=auth_failed`);
}
