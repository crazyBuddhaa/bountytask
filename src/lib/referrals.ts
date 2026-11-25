import { createAdminClient } from "@/lib/supabase/admin";
import { appendLedger } from "@/lib/ledger";
import { createNotification } from "@/lib/notifications";
import { recalcUserTier } from "@/lib/tiers";
import { getVerificationSettings } from "@/lib/verification";

function isUniqueViolation(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: string }).code;
  if (code === "23505") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("23505") || msg.includes("duplicate key");
}

/**
 * Credit the signup bonus (and process a pending referral code) for a
 * brand-new user, but only once. Safe to call from multiple entry points
 * (post-signup, OAuth callback, admin approval) since it checks the ledger
 * first and handles unique-constraint races on uq_ledger_signup_bonus_per_user.
 */
export async function creditSignupBonusIfNew(
  userId: string,
  referralCode?: string | null
) {
  const admin = createAdminClient();

  const { count } = await admin
    .from("ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) return { credited: false };

  try {
    await creditSignupBonus(userId);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { credited: false };
    }
    throw err;
  }

  if (referralCode) {
    try {
      await processReferral(userId, referralCode);
    } catch (e) {
      console.error("Referral processing error:", e);
    }
  }

  return { credited: true };
}

/** Referral signup bonus in kobo */
export const REFERRAL_BONUS_KOBO = 15_000; // ₦150

/** Minimum approved tasks a referred user must complete before the referral bonus unlocks */
export const REFERRAL_MIN_APPROVED_TASKS = 3;

/** Minimum task/news earnings (kobo) a referred user must accumulate before the referral bonus unlocks */
export const REFERRAL_MIN_EARNED_KOBO = 50_000; // ₦500

export async function creditReferralBonus(referredUserId: string) {
  const supabase = createAdminClient();

  // Require at least REFERRAL_MIN_APPROVED_TASKS approved task completions before paying referral bonus
  const { count: approvedTaskCount } = await supabase
    .from("task_completions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", referredUserId)
    .eq("status", "approved");

  if (!approvedTaskCount || approvedTaskCount < REFERRAL_MIN_APPROVED_TASKS) return;

  // Require at least REFERRAL_MIN_EARNED_KOBO earned from tasks/news before paying referral bonus
  const { data: earnedRows } = await supabase
    .from("ledger")
    .select("delta")
    .eq("user_id", referredUserId)
    .eq("type", "credit")
    .in("ref_type", ["task_reward", "news_read_reward"]);

  const totalEarnedKobo = (earnedRows ?? []).reduce(
    (sum, row) => sum + Number(row.delta ?? 0),
    0
  );
  if (totalEarnedKobo < REFERRAL_MIN_EARNED_KOBO) return;

  // If admin verification is enabled, the referred user must be kyc_verified
  // before the referral bonus is paid. This handles two paths:
  //  - User verified first, completes tasks after → bonus fires here (verified = true)
  //  - User completes tasks first, gets verified later → bonus fires from KYC approval route
  const settings = await getVerificationSettings();
  if (settings.fee_enabled) {
    const { data: profile } = await supabase
      .from("users")
      .select("kyc_verified")
      .eq("id", referredUserId)
      .single();
    if (!profile?.kyc_verified) return;
  }

  // Atomically claim the referral so concurrent triggers cannot double-credit
  const { data: referral } = await supabase
    .from("referrals")
    .update({
      bonus_credited: true,
      bonus_amount: REFERRAL_BONUS_KOBO,
      credited_at: new Date().toISOString(),
    })
    .eq("referred_id", referredUserId)
    .eq("bonus_credited", false)
    .select("id, referrer_id")
    .maybeSingle();

  if (!referral) return; // already credited or no referral

  // Credit referrer
  let ledgerEntry: { id: string } | null = null;
  try {
    ledgerEntry = await appendLedger({
      userId: referral.referrer_id,
      type: "credit",
      delta: REFERRAL_BONUS_KOBO,
      refType: "referral_bonus",
      refId: referral.id,
      note: `Referral bonus for user ${referredUserId}`,
    });
  } catch (err) {
    if (isUniqueViolation(err)) return;
    throw err;
  }

  // Notify referrer
  await createNotification({
    userId: referral.referrer_id,
    type: "referral_bonus",
    title: "Referral Bonus Earned! 🎁",
    message: `You earned ₦${(REFERRAL_BONUS_KOBO / 100).toFixed(2)} for a successful referral.`,
    refId: ledgerEntry?.id,
  });
}

/**
 * Credit the ₦150 referral bonus to the referrer when their referred user
 * completes at least 3 approved tasks and earns ₦500+ from tasks/news.
 *
 * Gate: if admin verification is ON (fee_enabled), the referred user must
 * also be kyc_verified before the bonus is paid. This prevents rewarding
 * referrals from users who never activated their account.
 * When verification is OFF, the bonus fires once the task/earnings thresholds are met.
 *
 * This function is called in two places:
 *  1. task complete / admin approval routes — fires after each approval
 *  2. admin KYC approval — re-fires for users who met task requirements first
 *     but weren't verified yet at that time
 */
export async function processReferral(
  referredUserId: string,
  referralCode: string
) {
  const supabase = createAdminClient();

  // Find referrer by code
  const { data: referrer } = await supabase
    .from("users")
    .select("id")
    .eq("referral_code", referralCode)
    .single();

  if (!referrer || referrer.id === referredUserId) return;

  // Prevent duplicate
  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_id", referredUserId)
    .single();

  if (existing) return;

  await supabase.from("referrals").insert({
    referrer_id: referrer.id,
    referred_id: referredUserId,
    bonus_credited: false,
    bonus_amount: 0,
  });

  // Update referred user's profile
  await supabase
    .from("users")
    .update({ referred_by: referrer.id })
    .eq("id", referredUserId);

  // Onboarding a new person can push the referrer up a tier.
  await recalcUserTier(referrer.id);
}

/** Signup bonus for new users */
export const SIGNUP_BONUS_KOBO = 5_000; // ₦50

export async function creditSignupBonus(userId: string) {
  await appendLedger({
    userId,
    type: "credit",
    delta: SIGNUP_BONUS_KOBO,
    refType: "signup_bonus",
    note: "Welcome bonus for new user registration",
  });

  await createNotification({
    userId,
    type: "signup_bonus",
    title: "Welcome Bonus! 🎉",
    message: `₦${(SIGNUP_BONUS_KOBO / 100).toFixed(2)} has been added to your account as a welcome bonus.`,
  });
}
