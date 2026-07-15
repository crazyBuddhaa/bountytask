/**
 * Adsterra Smartlink — publisher-side integration.
 *
 * Architecture note:
 *   Adsterra pays publishers in aggregate (CPM/CPA on total traffic volume),
 *   NOT per confirmed user action with an external_identifier. There is no
 *   S2S postback for publishers — S2S postbacks on Adsterra are for advertisers
 *   tracking their own campaign conversions, which does not apply here.
 *
 *   This means we cannot verify that a specific BountyTask user converted.
 *   The reward is therefore:
 *     - Fixed internal amount (set by admin, funded from your Adsterra margin)
 *     - Applied OPTIMISTICALLY at click time (the server logs the click and
 *       credits the ledger before the user's browser opens the smartlink)
 *     - Reconciled weekly: compare total ledger payout for "asterra" completions
 *       against actual Adsterra revenue received for the same period; adjust
 *       rewardKobo down if you're paying out more than you're earning
 *
 *   Controls that replace postback verification:
 *     - Tight daily cap (default 3, not 10 like other providers)
 *     - Per-user cooldown between clicks (default 30 min)
 *     - Both enforced server-side before the credit fires
 */
import { createAdminClient } from "@/lib/supabase/admin"

export const ASTERRA_COOLDOWN_MINUTES = 30

export type AsterraSettings = {
  enabled: boolean
  dailyCap: number
  /** Fixed internal reward per click in kobo. Funded from your Adsterra margin. */
  rewardKobo: number
  /** Base smartlink URL from your Adsterra publisher dashboard. */
  smartlinkUrl: string
}

export async function getAsterraSettings(): Promise<AsterraSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", [
      "asterra_enabled",
      "asterra_daily_cap",
      "asterra_reward_kobo",
      "asterra_smartlink_url",
    ])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  return {
    enabled:      Boolean(s.asterra_enabled      ?? false),
    dailyCap:     Number(s.asterra_daily_cap      ?? 3),
    rewardKobo:   Number(s.asterra_reward_kobo    ?? 250),
    smartlinkUrl: String(s.asterra_smartlink_url  ?? ""),
  }
}

/**
 * Build the Adsterra smartlink URL for a specific user.
 * Appends `sub1={userId}` so Adsterra's own analytics can segment by user
 * (shows up in your Adsterra dashboard under sub-IDs, not as a postback).
 */
export function buildAsterraSmartlinkUrl(baseUrl: string, userId: string): string {
  if (!baseUrl) return ""
  const sep = baseUrl.includes("?") ? "&" : "?"
  return `${baseUrl}${sep}sub1=${encodeURIComponent(userId)}`
}

/**
 * Return the timestamp of the user's most recent Adsterra smartlink click,
 * or null if they have never clicked.
 * Used to enforce the per-click cooldown.
 */
export async function getAsterraLastClickAt(userId: string): Promise<Date | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("ad_task_logs")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("provider", "asterra")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.completed_at ? new Date(data.completed_at) : null
}
