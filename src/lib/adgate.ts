import { createAdminClient } from "@/lib/supabase/admin"

export type AdGateSettings = {
  enabled: boolean
  dailyCap: number
  wallId: string
  /**
   * AdGate Media verifies postbacks by source IP rather than a signed hash.
   * The IP is shown on the publisher panel under the wall's Postback section —
   * https://panel.adgatemedia.com/affiliate/vc-walls
   */
  postbackIp: string
}

export async function getAdGateSettings(): Promise<AdGateSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["adgate_enabled", "adgate_daily_cap", "adgate_wall_id", "adgate_postback_ip"])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  return {
    enabled:    Boolean(s.adgate_enabled    ?? false),
    dailyCap:   Number(s.adgate_daily_cap   ?? 10),
    wallId:     String(s.adgate_wall_id     ?? ""),
    postbackIp: String(s.adgate_postback_ip ?? ""),
  }
}

/**
 * Build the AdGate Rewards VC Wall embed URL.
 * Format per AdGate's Web Integration docs: https://wall.adgaterewards.com/{wallId}/{userId}
 * Intended to be opened in a real browser tab/iframe — not a webview.
 */
export function buildAdGateWallUrl(wallId: string, userId: string): string {
  return `https://wall.adgaterewards.com/${encodeURIComponent(wallId)}/${encodeURIComponent(userId)}`
}

/**
 * AdGate postback sends {payout} in USD as a decimal string (e.g. "0.25").
 * Fixed conversion: 1 USD = 1600 NGN; result in kobo.
 */
export function adgateUsdToKobo(usdString: string): number {
  const usd = parseFloat(usdString)
  if (isNaN(usd) || usd <= 0) return 250 // fallback ₦2.50
  const USD_TO_NGN = 1600
  return Math.round(usd * USD_TO_NGN * 100)
}
