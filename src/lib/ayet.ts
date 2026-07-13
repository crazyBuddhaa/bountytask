import { createAdminClient } from "@/lib/supabase/admin"

export type AyetSettings = {
  enabled: boolean
  dailyCap: number
  placementKey: string
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
 * Build the Ayet Studios offer wall embed URL.
 * Ayet's web offer wall is an iframe at this URL with ext_user_id embedded.
 * The placement_key identifies your ad zone; ext_user_id is echoed on postbacks.
 */
export function buildAyetWallUrl(placementKey: string, userId: string): string {
  const params = new URLSearchParams({
    placement_key: placementKey,
    ext_user_id: userId,
    // platform label — available in Ayet's reporting
    subid: "bountytask",
  })
  return `https://www.ayetstudios.com/offers/web_offerwall?${params}`
}

/**
 * Ayet postback sends `reward` in USD as a decimal string (e.g. "0.25").
 * Fixed conversion: 1 USD = 1600 NGN; result in kobo.
 */
export function ayetUsdToKobo(usdString: string): number {
  const usd = parseFloat(usdString)
  if (isNaN(usd) || usd <= 0) return 250 // fallback ₦2.50
  const USD_TO_NGN = 1600
  return Math.round(usd * USD_TO_NGN * 100)
}
