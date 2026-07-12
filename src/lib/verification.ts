import { createAdminClient } from "@/lib/supabase/admin"

export type VerificationSettings = {
  fee_enabled: boolean
  fee_amount: number
  payment_method: "paystack" | "bank_transfer"
  bank_name: string
  bank_number: string
  bank_account_name: string
  phone_verification_enabled: boolean
}

/**
 * Withdrawal verification fee settings, keyed by `verification_*` /
 * `bank_transfer_*` rows in platform_settings. This fee gates withdrawals,
 * not account creation — a user can register and use the app for free, but
 * must pass this one-time check before their first withdrawal.
 */
export async function getVerificationSettings(): Promise<VerificationSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", [
      "verification_fee_enabled",
      "verification_fee_amount",
      "verification_payment_method",
      "bank_transfer_name",
      "bank_transfer_number",
      "bank_transfer_bank",
      "phone_verification_enabled",
    ])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))

  return {
    fee_enabled:                 s.verification_fee_enabled       ?? false,
    fee_amount:                  s.verification_fee_amount         ?? 50000,
    payment_method:              s.verification_payment_method     ?? "paystack",
    bank_name:                   s.bank_transfer_bank              ?? "",
    bank_number:                 s.bank_transfer_number            ?? "",
    bank_account_name:           s.bank_transfer_name              ?? "",
    phone_verification_enabled:  s.phone_verification_enabled      ?? false,
  }
}

/** True if this user still needs to pay the verification fee before withdrawing. */
export async function needsWithdrawalVerification(userId: string): Promise<boolean> {
  const settings = await getVerificationSettings()
  if (!settings.fee_enabled) return false

  const admin = createAdminClient()
  const { data } = await admin.from("users").select("kyc_verified").eq("id", userId).single()
  return !data?.kyc_verified
}

/** True if this user still needs to verify their phone number before withdrawing. */
export async function needsPhoneVerification(userId: string): Promise<boolean> {
  const settings = await getVerificationSettings()
  if (!settings.phone_verification_enabled) return false

  const admin = createAdminClient()
  const { data } = await admin.from("users").select("phone_verified").eq("id", userId).single()
  return !data?.phone_verified
}
