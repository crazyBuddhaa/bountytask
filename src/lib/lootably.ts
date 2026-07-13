import { createAdminClient } from "@/lib/supabase/admin"

export type LootablySettings = {
  enabled: boolean
  dailyCap: number
  apiKey: string
  secret: string
}

export async function getLootablySettings(): Promise<LootablySettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["lootably_enabled", "lootably_daily_cap", "lootably_api_key", "lootably_secret"])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  return {
    enabled:    Boolean(s.lootably_enabled   ?? false),
    dailyCap:   Number(s.lootably_daily_cap  ?? 10),
    apiKey:     String(s.lootably_api_key    ?? ""),
    secret:     String(s.lootably_secret     ?? ""),
  }
}

/**
 * Lootably postback sends `reward` in USD as a decimal string.
 * Fixed conversion: 1 USD = 1600 NGN; result in kobo.
 */
export function lootablyUsdToKobo(usdString: string): number {
  const usd = parseFloat(usdString)
  if (isNaN(usd) || usd <= 0) return 250 // fallback ₦2.50
  const USD_TO_NGN = 1600
  return Math.round(usd * USD_TO_NGN * 100)
}
