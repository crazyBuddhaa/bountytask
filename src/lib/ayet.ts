import { createAdminClient } from "@/lib/supabase/admin"

export type AyetSettings = {
  enabled: boolean
  dailyCap: number
  placementKey: string
  /**
   * Static postback secret — a random token YOU choose and append to the
   * callback URL in Ayet's dashboard as `&secret=<value>`.
   * Ayet offerwall postbacks carry no HMAC; this is the only auth mechanism.
   * Set it in Admin Settings → Ayet Studios → Secret Key.
   */
  secretKey: string
}

export async function getAyetSettings(): Promise<AyetSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["ayet_enabled", "ayet_daily_cap", "ayet_placement_key", "ayet_secret_key"])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  return {
    enabled:      Boolean(s.ayet_enabled       ?? false),
    dailyCap:     Number(s.ayet_daily_cap       ?? 10),
    placementKey: String(s.ayet_placement_key   ?? ""),
    secretKey:    String(s.ayet_secret_key      ?? ""),
  }
}

/**
 * Build the Ayet Studios web offerwall embed URL.
 * `external_identifier` (ext_user_id) is echoed back as `uid` on every postback —
 * use your internal user ID here so postbacks map directly to ledger entries.
 */
export function buildAyetWallUrl(placementKey: string, userId: string): string {
  const params = new URLSearchParams({
    placement_key:       placementKey,
    ext_user_id:         userId,
    subid:               "bountytask",
  })
  return `https://www.ayetstudios.com/offers/web_offerwall?${params}`
}

/**
 * Convert Ayet's `payout_usd` string to kobo.
 *
 * Always use `payout_usd` (the actual USD payout), NOT `currency_amount`
 * (virtual currency units that depend on how you configured your virtual
 * currency in Ayet's dashboard and are meaningless for NGN conversion).
 *
 * Exchange rate: 1 USD = 1600 NGN. Update periodically to match the live rate.
 * Result is in kobo (1 NGN = 100 kobo).
 */
export function ayetUsdToKobo(payoutUsdString: string): number {
  const usd = parseFloat(payoutUsdString)
  if (isNaN(usd) || usd <= 0) return 250 // fallback ₦2.50
  const USD_TO_NGN = 1600
  return Math.round(usd * USD_TO_NGN * 100)
}
