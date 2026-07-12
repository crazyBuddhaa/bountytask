import { createAdminClient } from "@/lib/supabase/admin"

export type AdvertiserSettings = {
  submissions_enabled: boolean
  min_budget_kobo: number
  requirements: string
  pricing_info: string
  contact_email: string
  submission_fee_enabled: boolean
  submission_fee_kobo: number
}

export type AdsSettings = {
  enabled: boolean
  dashboard_snippet: string
  tasklist_snippet: string
}

const ADVERTISER_KEYS = [
  "advertiser_submissions_enabled",
  "advertiser_min_budget_kobo",
  "advertiser_requirements",
  "advertiser_pricing_info",
  "advertiser_contact_email",
  "advertiser_submission_fee_enabled",
  "advertiser_submission_fee_kobo",
] as const

const ADS_KEYS = ["ads_enabled", "ads_dashboard_snippet", "ads_tasklist_snippet"] as const

/**
 * Advertiser self-serve submission settings, admin-configurable via
 * platform_settings. Off by default — `submissions_enabled` gates the whole
 * /advertise intake flow.
 */
export async function getAdvertiserSettings(): Promise<AdvertiserSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin.from("platform_settings").select("key, value").in("key", ADVERTISER_KEYS)
  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))

  return {
    submissions_enabled:    s.advertiser_submissions_enabled    ?? false,
    min_budget_kobo:        s.advertiser_min_budget_kobo         ?? 500_000,
    requirements:            s.advertiser_requirements            ?? "",
    pricing_info:            s.advertiser_pricing_info            ?? "",
    contact_email:           s.advertiser_contact_email           ?? "",
    submission_fee_enabled: s.advertiser_submission_fee_enabled  ?? false,
    submission_fee_kobo:    s.advertiser_submission_fee_kobo      ?? 500_000,
  }
}

/** In-app display ad placements, admin-configurable via platform_settings. Off by default. */
export async function getAdsSettings(): Promise<AdsSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin.from("platform_settings").select("key, value").in("key", ADS_KEYS)
  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))

  return {
    enabled:            s.ads_enabled           ?? false,
    dashboard_snippet:  s.ads_dashboard_snippet  ?? "",
    tasklist_snippet:   s.ads_tasklist_snippet   ?? "",
  }
}
