import { createAdminClient } from "@/lib/supabase/admin"

export type CpxSettings = {
  enabled: boolean
  dailyCap: number
  appId: string
  secureHashKey: string
}

export async function getCpxSettings(): Promise<CpxSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["cpx_enabled", "cpx_daily_cap", "cpx_app_id", "cpx_secure_hash_key"])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))
  return {
    enabled:       Boolean(s.cpx_enabled          ?? false),
    dailyCap:      Number(s.cpx_daily_cap          ?? 10),
    appId:         String(s.cpx_app_id             ?? ""),
    secureHashKey: String(s.cpx_secure_hash_key    ?? ""),
  }
}

/**
 * Build the CPX Research survey wall URL for a given user.
 * The `ext_user_id` is echoed back on every postback so our route can credit
 * the correct user without any server-side state lookup.
 */
/**
 * Build the CPX Research survey wall iframe URL.
 *
 * IMPORTANT: Do NOT include `output_method=web_layer` here.
 * The "web_layer" mode is a JavaScript floating overlay — it manipulates the
 * parent page DOM and does not work when loaded inside an <iframe>. Leave the
 * output method unset so CPX serves the plain survey-list page that embeds
 * cleanly in an iframe.
 */
export function buildCpxSurveyUrl(
  appId: string,
  userId: string,
  username: string,
  origin: string
): string {
  const params = new URLSearchParams({
    app_id: appId,
    ext_user_id: userId,
    username: username,
    // subid_1 is echoed through on every postback — useful for analytics
    subid_1: "bountytask",
    // Tell CPX where to redirect the user after survey completion
    survey_finished_callback: `${origin}/dashboard/tasks/surveys?done=1`,
  })
  return `https://live.cpx-research.com/index.php?${params}`
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
