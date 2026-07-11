import { createClient } from "@/lib/supabase/server";
import { creditSignupBonusIfNew } from "@/lib/referrals";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

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

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}
