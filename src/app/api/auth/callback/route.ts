import { createClient } from "@/lib/supabase/server";
import { creditSignupBonus, processReferral } from "@/lib/referrals";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const userId = data.user.id;

      // Check if this is a brand new user by seeing if they have any ledger entries
      const adminClient = (await import("@/lib/supabase/admin")).createAdminClient();
      const { count } = await adminClient
        .from("ledger")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (count === 0) {
        // New user — grant signup bonus
        try {
          await creditSignupBonus(userId);
        } catch (e) {
          console.error("Signup bonus error:", e);
        }

        // Process referral if referral_code in user metadata
        const referralCode =
          data.user.user_metadata?.referral_code as string | undefined;
        if (referralCode) {
          try {
            await processReferral(userId, referralCode);
          } catch (e) {
            console.error("Referral processing error:", e);
          }
        }
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
