import { createClient } from "@/lib/supabase/server";
import { creditSignupBonusIfNew } from "@/lib/referrals";
import { sanitizeRedirectPath } from "@/lib/security";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const nextParam = searchParams.get("next");
  const cookieNext = request.cookies.get("bt_auth_next")?.value;

  const supabase = await createClient();
  let authUser: { id: string; user_metadata?: Record<string, unknown>; recovery_sent_at?: string } | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      authUser = data.user;
    }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error && data.user) {
      authUser = data.user;
    }
  }

  if (authUser) {
    // Determine destination: explicit ?next, type=recovery, bt_auth_next cookie,
    // or recent password-recovery request (handles clicking the email on another device).
    let rawNext = nextParam ?? cookieNext ?? null;
    if (!rawNext && type === "recovery") {
      rawNext = "/reset-password";
    }
    if (!rawNext && authUser.recovery_sent_at) {
      const sentMs = Date.parse(authUser.recovery_sent_at);
      if (Number.isFinite(sentMs) && Date.now() - sentMs < 60 * 60 * 1000) {
        rawNext = "/reset-password";
      }
    }
    const next = sanitizeRedirectPath(rawNext, "/dashboard");

    // Idempotent — no-ops if this user already has a ledger entry
    // (e.g. the bonus was already credited right after signup).
    if (next !== "/reset-password") {
      const referralCode =
        authUser.user_metadata?.referral_code as string | undefined;
      try {
        await creditSignupBonusIfNew(authUser.id, referralCode);
      } catch (e) {
        console.error("Signup bonus error:", e);
      }
    }

    const res = NextResponse.redirect(`${origin}${next}`);
    if (cookieNext) {
      res.cookies.delete("bt_auth_next");
    }
    return res;
  }

  const res = NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
  if (cookieNext) {
    res.cookies.delete("bt_auth_next");
  }
  return res;
}
