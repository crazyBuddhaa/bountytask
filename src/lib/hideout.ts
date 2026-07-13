import { createAdminClient } from "@/lib/supabase/admin"

export type HideoutSettings = {
  enabled: boolean
  dailyCap: number
  rewardKobo: number
  publisherId: string
  secret: string
}

export async function getHideoutSettings(): Promise<HideoutSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", [
      "hideout_enabled",
      "hideout_daily_cap",
      "hideout_reward_kobo",
      "hideout_publisher_id",
      "hideout_secret",
    ])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  return {
    enabled:     Boolean(s.hideout_enabled      ?? false),
    dailyCap:    Number(s.hideout_daily_cap      ?? 5),
    rewardKobo:  Number(s.hideout_reward_kobo    ?? 100),
    publisherId: String(s.hideout_publisher_id   ?? ""),
    secret:      String(s.hideout_secret         ?? ""),
  }
}
