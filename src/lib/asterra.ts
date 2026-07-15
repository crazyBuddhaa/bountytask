import { createAdminClient } from "@/lib/supabase/admin"

export type AsterraSettings = {
  enabled: boolean
  dailyCap: number
  /** Base smartlink URL from the Asterra dashboard (with your campaign/tracking params). */
  smartlinkUrl: string
  /**
   * Static postback secret — a random token YOU generate and append to the
   * postback URL in Asterra's dashboard as `&secret=<value>`.
   * Asterra smartlink postbacks do not carry an HMAC signature; this static
   * token is the only server-side auth mechanism.
   */
  secretKey: string
}

export async function getAsterraSettings(): Promise<AsterraSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", [
      "asterra_enabled",
      "asterra_daily_cap",
      "asterra_smartlink_url",
      "asterra_secret_key",
    ])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  return {
    enabled:      Boolean(s.asterra_enabled      ?? false),
    dailyCap:     Number(s.asterra_daily_cap      ?? 10),
    smartlinkUrl: String(s.asterra_smartlink_url  ?? ""),
    secretKey:    String(s.asterra_secret_key     ?? ""),
  }
}

/**
 * Build the Asterra smartlink URL for a given user.
 * Appends `aff_sub={userId}` so Asterra echoes it back in the postback
 * as `{aff_sub}`, which we map to our internal user ID.
 */
export function buildAsterraSmartlinkUrl(baseUrl: string, userId: string): string {
  if (!baseUrl) return ""
  const sep = baseUrl.includes("?") ? "&" : "?"
  return `${baseUrl}${sep}aff_sub=${encodeURIComponent(userId)}`
}

/**
 * Convert Asterra's `{payout}` macro value (USD string) to kobo.
 * Always use `payout_usd`, not virtual-currency units.
 * Exchange rate: 1 USD = 1600 NGN. Update periodically to match the live rate.
 */
export function asterraUsdToKobo(payoutUsdString: string): number {
  const usd = parseFloat(payoutUsdString)
  if (isNaN(usd) || usd <= 0) return 250 // fallback ₦2.50
  const USD_TO_NGN = 1600
  return Math.round(usd * USD_TO_NGN * 100)
}
