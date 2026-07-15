import { createHash } from "crypto"
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"

export type CpxSettings = {
  enabled: boolean
  dailyCap: number
  appId: string
  secureHashKey: string
}

/**
 * Fetch CPX settings from platform_settings.
 *
 * Cached for 60 seconds so that every postback request doesn't pay a DB
 * round-trip for hash validation. The cache is invalidated immediately
 * whenever the admin saves CPX settings (revalidateTag("cpx-settings")).
 *
 * 60 s is long enough to absorb a burst of concurrent postbacks yet short
 * enough that a key rotation takes effect within one minute without a deploy.
 */
export const getCpxSettings = unstable_cache(
  async (): Promise<CpxSettings> => {
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", ["cpx_enabled", "cpx_daily_cap", "cpx_app_id", "cpx_secure_hash_key"])

    const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
    return {
      // Supabase JSONB returns native booleans, but guard against the string
      // "false" being stored — Boolean("false") === true which would silently
      // enable CPX when the admin disabled it.
      enabled:       s.cpx_enabled === true || s.cpx_enabled === "true",
      dailyCap:      Number(s.cpx_daily_cap          ?? 10),
      appId:         String(s.cpx_app_id             ?? ""),
      secureHashKey: String(s.cpx_secure_hash_key    ?? ""),
    }
  },
  ["cpx-settings"],
  { revalidate: 60, tags: ["cpx-settings"] }
)

/**
 * Generate the CPX Research secure hash.
 *
 * Per CPX publisher dashboard docs: MD5(ext_user_id + '-' + secure_hash_key)
 * Computed server-side so the secureHashKey is never exposed to the browser.
 * Passed into window.config as `secure_hash` before the CPX script tag loads.
 */
export function buildCpxSecureHash(userId: string, secureHashKey: string): string {
  return createHash("md5").update(`${userId}-${secureHashKey}`).digest("hex")
}

/**
 * CPX Research postback sends `payout` in USD as a decimal string (e.g. "0.50").
 * Convert to kobo at a fixed NGN exchange rate.
 * Rate is intentionally conservative (favour user slightly below market).
 * TODO: store `usd_to_ngn_rate` in platform_settings for admin control.
 */
export function cpxUsdCentsToKobo(usdString: string): number {
  const usd = parseFloat(usdString)
  if (isNaN(usd) || usd <= 0) return 500 // fallback: ₦5
  const USD_TO_NGN = 1600
  return Math.round(usd * USD_TO_NGN * 100) // usd → NGN → kobo
}
