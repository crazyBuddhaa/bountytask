import { createAdminClient } from "@/lib/supabase/admin";
import { appendLedger } from "@/lib/ledger";
import { createNotification } from "@/lib/notifications";
import { recalcUserTier } from "@/lib/tiers";
import { getVerificationSettings } from "@/lib/verification";

/**
 * Credit the signup bonus (and process a pending referral code) for a
 * brand-new user, but only once. Safe to call from multiple entry points
 * (post-signup, OAuth callback, admin approval) since it checks the ledger
 * first and is a no-op for any user who already has an entry.
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

  await creditSignupBonus(userId);

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
export const REFERRAL_BONUS_KOBO = 50_000; // ₦500

export async function creditReferralBonus(referredUserId: string) {
  const supabase = createAdminClient();

  // Find referral record
  const { data: referral } = await supabase
    .from("referrals")
    .select("id, referrer_id, bonus_credited")
    .eq("referred_id", referredUserId)
    .single();

  if (!referral || referral.bonus_credited) return; // already credited or no referral

  // If admin verification is enabled, the referred user must be kyc_verified
  // before the referral bonus is paid. This handles two paths:
  //  - User verified first, completes task after → bonus fires here (verified = true)
  //  - User completes task first, gets verified later → bonus fires from KYC approval route
  const settings = await getVerificationSettings();
  if (settings.fee_enabled) {
    const { data: profile } = await supabase
      .from("users")
      .select("kyc_verified")
      .eq("id", referredUserId)
      .single();
    if (!profile?.kyc_verified) return;
  }

  // Credit referrer
  const ledgerEntry = await appendLedger({
    userId: referral.referrer_id,
    type: "credit",
    delta: REFERRAL_BONUS_KOBO,
    refType: "referral_bonus",
    refId: referral.id,
    note: `Referral bonus for user ${referredUserId}`,
  });

  // Mark referral as credited
  await supabase
    .from("referrals")
    .update({
      bonus_credited: true,
      bonus_amount: REFERRAL_BONUS_KOBO,
      credited_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  // Notify referrer
  await createNotification({
    userId: referral.referrer_id,
    type: "referral_bonus",
    title: "Referral Bonus Earned! 🎁",
    message: `You earned ₦${(REFERRAL_BONUS_KOBO / 100).toFixed(2)} for a successful referral.`,
    refId: ledgerEntry.id,
  });
}

/**
 * Credit the ₦500 referral bonus to the referrer when their referred user
 * completes their first approved task.
 *
 * Gate: if admin verification is ON (fee_enabled), the referred user must
 * also be kyc_verified before the bonus is paid. This prevents rewarding
 * referrals from users who never activated their account.
 * When verification is OFF, the bonus fires on first task completion alone.
 *
 * This function is called in two places:
 *  1. task complete / admin approval routes — fires after each approval
 *  2. admin KYC approval — re-fires for users who completed a task first
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
export const SIGNUP_BONUS_KOBO = 20_000; // ₦200

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
