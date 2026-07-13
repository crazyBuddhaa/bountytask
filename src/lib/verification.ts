import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"

export type VerificationSettings = {
  fee_enabled: boolean
  fee_amount: number
  payment_method: "paystack" | "bank_transfer"
  bank_name: string
  bank_number: string
  bank_account_name: string
  phone_verification_enabled: boolean
  min_withdrawal_kobo: number
}

const VERIFICATION_SETTINGS_KEYS = [
  "verification_fee_enabled",
  "verification_fee_amount",
  "verification_payment_method",
  "bank_transfer_name",
  "bank_transfer_number",
  "bank_transfer_bank",
  "phone_verification_enabled",
  "min_withdrawal_kobo",
] as const

/**
 * Withdrawal verification fee settings. Cached for 5 minutes — settings
 * change rarely and are read on every layout load and every withdrawal request.
 */
export const getVerificationSettings = unstable_cache(
  async (): Promise<VerificationSettings> => {
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", [...VERIFICATION_SETTINGS_KEYS])

    const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))

    return {
      fee_enabled:                s.verification_fee_enabled      ?? false,
      fee_amount:                 s.verification_fee_amount        ?? 50000,
      payment_method:             s.verification_payment_method    ?? "paystack",
      bank_name:                  s.bank_transfer_bank             ?? "",
      bank_number:                s.bank_transfer_number           ?? "",
      bank_account_name:          s.bank_transfer_name             ?? "",
      phone_verification_enabled: s.phone_verification_enabled     ?? false,
      min_withdrawal_kobo:        s.min_withdrawal_kobo            ?? 500_000,
    }
  },
  ["verification-settings"],
  { revalidate: 300, tags: ["verification-settings"] }
)

/** Minimum withdrawal amount in kobo, configurable by admins via platform_settings. */
export async function getMinWithdrawalKobo(): Promise<number> {
  const settings = await getVerificationSettings()
  return settings.min_withdrawal_kobo
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
