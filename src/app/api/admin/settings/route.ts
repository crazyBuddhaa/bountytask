import { NextResponse, type NextRequest } from "next/server"
import { revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

// Keys that getVerificationSettings() reads and caches under this tag with a
// 5-minute TTL. Revalidate on write so admin changes apply immediately.
const VERIFICATION_SETTINGS_KEYS = new Set([
  "verification_fee_enabled",
  "verification_fee_amount",
  "verification_payment_method",
  "bank_transfer_name",
  "bank_transfer_number",
  "bank_transfer_bank",
  "phone_verification_enabled",
  "min_withdrawal_kobo",
])

// Keys that affect task completion behaviour. Revalidate immediately so the
// global AI switch takes effect without waiting for any cache TTL.
const TASK_SETTINGS_KEYS = new Set([
  "ai_verify_all_tasks",
])

// Keys that getCpxSettings() reads and caches under "cpx-settings" with a
// 60-second TTL. Revalidate immediately on write so key rotations take effect
// without waiting for the TTL to expire.
const CPX_SETTINGS_KEYS = new Set([
  "cpx_enabled",
  "cpx_daily_cap",
  "cpx_app_id",
  "cpx_secure_hash_key",
])

export const dynamic = "force-dynamic"

const settingsSchema = z.object({
  // ── Withdrawal & verification ──────────────────────────────────────────────
  verification_fee_enabled:    z.boolean().optional(),
  verification_fee_amount:     z.number().int().positive().optional(),
  verification_payment_method: z.enum(["paystack", "bank_transfer"]).optional(),
  bank_transfer_name:          z.string().max(100).optional(),
  bank_transfer_number:        z.string().max(20).optional(),
  bank_transfer_bank:          z.string().max(100).optional(),
  phone_verification_enabled:  z.boolean().optional(),
  min_withdrawal_kobo:         z.number().int().min(100, "Minimum withdrawal must be at least ₦1").optional(),

  // ── Advertiser submissions ─────────────────────────────────────────────────
  advertiser_submissions_enabled:    z.boolean().optional(),
  advertiser_min_budget_kobo:        z.number().int().positive().optional(),
  advertiser_requirements:           z.string().max(4000).optional(),
  advertiser_pricing_info:           z.string().max(4000).optional(),
  advertiser_contact_email:          z.string().email().optional(),
  advertiser_submission_fee_enabled: z.boolean().optional(),
  advertiser_submission_fee_kobo:    z.number().int().positive().optional(),

  // ── Display ads (AdSense snippets) ────────────────────────────────────────
  ads_enabled:           z.boolean().optional(),
  ads_dashboard_snippet: z.string().max(4000).optional(),
  ads_tasklist_snippet:  z.string().max(4000).optional(),

  // ── Google IMA SDK ─────────────────────────────────────────────────────────
  ima_enabled:      z.boolean().optional(),
  ima_daily_cap:    z.number().int().min(1).max(10).optional(),
  ima_reward_kobo:  z.number().int().min(1).optional(),
  ima_ad_tag_url:   z.string().max(500).optional(),


  // ── Lootably ───────────────────────────────────────────────────────────────
  lootably_enabled:   z.boolean().optional(),
  lootably_daily_cap: z.number().int().min(1).max(20).optional(),
  lootably_api_key:   z.string().max(200).optional(),
  lootably_secret:    z.string().max(200).optional(),

  // ── CPX Research ───────────────────────────────────────────────────────────
  cpx_enabled:          z.boolean().optional(),
  cpx_daily_cap:        z.number().int().min(1).max(20).optional(),
  cpx_app_id:           z.string().max(200).optional(),
  cpx_secure_hash_key:  z.string().max(200).optional(),

  // ── AdGate Media ───────────────────────────────────────────────────────────
  adgate_enabled:      z.boolean().optional(),
  adgate_daily_cap:    z.number().int().min(1).max(20).optional(),
  adgate_wall_id:      z.string().max(200).optional(),
  adgate_postback_ip:  z.string().max(45).optional(), // IPv4 or IPv6

  // ── Adsterra Smartlink ─────────────────────────────────────────────────────
  asterra_enabled:       z.boolean().optional(),
  asterra_daily_cap:     z.number().int().min(1).max(10).optional(),
  asterra_reward_kobo:   z.number().int().min(1).optional(),
  asterra_smartlink_url: z.string().max(500).optional(),

  // ── Global AI verification ─────────────────────────────────────────────────
  ai_verify_all_tasks: z.boolean().optional(),
})

async function assertAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return data && ["admin", "super_admin"].includes(data.role)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { data: rows } = await admin.from("platform_settings").select("key, value")
  const settings = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))

  return NextResponse.json({ data: settings, error: null })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const admin = createAdminClient()
  const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined) as [string, unknown][]

  for (const [key, value] of entries) {
    await admin.from("platform_settings").upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: "key" }
    )
  }

  if (entries.some(([key]) => VERIFICATION_SETTINGS_KEYS.has(key))) {
    revalidateTag("verification-settings")
  }
  if (entries.some(([key]) => CPX_SETTINGS_KEYS.has(key))) {
    revalidateTag("cpx-settings")
  }
  if (entries.some(([key]) => TASK_SETTINGS_KEYS.has(key))) {
    revalidateTag("task-settings")
  }

  await auditLog({
    actorId: user.id,
    action: "settings.update",
    targetType: "platform_settings",
    targetId: undefined,
    details: { keys: entries.map(([k]) => k) },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data: { updated: entries.map(([k]) => k) }, error: null })
}
