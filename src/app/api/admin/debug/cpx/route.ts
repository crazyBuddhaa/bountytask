/**
 * Admin-only CPX diagnostic endpoint.
 *
 * GET /api/admin/debug/cpx
 *
 * Returns a full health-check of the CPX integration:
 *   - settings completeness
 *   - BOTH hash formulas with sample computations:
 *       • widget hash  — MD5(userId + '-' + key)  — passed to window.config
 *       • postback hash — MD5(trans_id + '-' + key) — what CPX sends back
 *   - postback URL template (paste into CPX publisher dashboard)
 *   - a ready-to-fire test postback URL with a unique trans_id (timestamped)
 *
 * The secure hash key is never returned in plaintext — only a masked version
 * and sample hash outputs are included.
 */
import { NextResponse }                               from "next/server"
import { createClient }                               from "@/lib/supabase/server"
import { createAdminClient }                          from "@/lib/supabase/admin"
import { getCpxSettings, buildCpxSecureHash, validateCpxPostbackHash, CPX_POSTBACK_IPS } from "@/lib/cpx"
import { createHash }                                 from "crypto"

// Use the env var so this keeps working if the domain changes.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bountytask.dpdns.org"

async function assertAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return !!data && ["admin", "super_admin"].includes(data.role)
}

/** Mask a string: show first 4 and last 4 chars, replace middle with ****. */
function mask(s: string): string {
  if (!s)            return "(empty)"
  if (s.length <= 8) return "*".repeat(s.length)
  return `${s.slice(0, 4)}****${s.slice(-4)}`
}

export const dynamic = "force-dynamic"

export async function GET() {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)                       return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ error: "Forbidden"    }, { status: 403 })

  // ── Settings ──────────────────────────────────────────────────────────────
  const settings = await getCpxSettings()

  // ── Widget hash diagnostic ────────────────────────────────────────────────
  // Formula: MD5(ext_user_id + '-' + secure_hash_key)
  // This is what we pass into window.config.general_config.secure_hash.
  const widgetHashOutput = settings.secureHashKey
    ? buildCpxSecureHash(user.id, settings.secureHashKey)
    : "(no key — hash not computed)"

  // ── Postback hash diagnostic ──────────────────────────────────────────────
  // Formula: MD5(trans_id + '-' + secure_hash_key)
  // This is what CPX sends in the `hash` query param on the postback.
  // Use a fixed sample trans_id so the admin can verify the formula manually.
  const sampleTransId         = "sample-trans-001"
  const postbackHashOutput    = settings.secureHashKey
    ? createHash("md5").update(`${sampleTransId}-${settings.secureHashKey}`).digest("hex")
    : "(no key — hash not computed)"
  const postbackHashVerifies  = settings.secureHashKey
    ? validateCpxPostbackHash(sampleTransId, settings.secureHashKey, postbackHashOutput)
    : false

  // ── Test postback URL ─────────────────────────────────────────────────────
  // Use a timestamped trans_id so each call to this debug route generates a
  // fresh, unused ID — the dedup system won't block repeated test runs.
  const testTransId  = `cpx-debug-${Date.now()}`
  const testHash     = settings.secureHashKey
    ? createHash("md5").update(`${testTransId}-${settings.secureHashKey}`).digest("hex")
    : "(no key)"
  const testUserId   = user.id  // credits the admin's own account — $0.01 = ₦16
  const testPostback =
    `${APP_URL}/api/postback/cpx` +
    `?user_id=${encodeURIComponent(testUserId)}` +
    `&trans_id=${encodeURIComponent(testTransId)}` +
    `&status=1` +
    `&hash=${encodeURIComponent(testHash)}` +
    `&amount_usd=0.01` +
    `&amount_local=0.01`

  // ── Postback URL template (copy into CPX publisher dashboard) ─────────────
  const postbackTemplate =
    `${APP_URL}/api/postback/cpx` +
    `?user_id={user_id}` +
    `&trans_id={trans_id}` +
    `&status={status}` +
    `&hash={secure_hash}` +
    `&amount_usd={amount_usd}` +
    `&amount_local={amount_local}`

  // ── Checks ────────────────────────────────────────────────────────────────
  const checks = {
    cpx_enabled:            settings.enabled,
    has_app_id:             !!settings.appId,
    has_hash_key:           !!settings.secureHashKey,
    app_id_is_number:       !isNaN(Number(settings.appId)),
    daily_cap_nonzero:      settings.dailyCap > 0,
    postback_hash_verifies: postbackHashVerifies,
  }

  const allPassed = Object.values(checks).every(Boolean)

  return NextResponse.json({
    status:  allPassed ? "ok" : "misconfigured",
    checks,

    settings: {
      enabled:    settings.enabled,
      app_id:     settings.appId    || "(empty)",
      hash_key:   mask(settings.secureHashKey),
      daily_cap:  settings.dailyCap,
    },

    hash_diagnostic: {
      widget_hash: {
        formula:       "MD5(ext_user_id + '-' + secure_hash_key)",
        description:   "Passed into window.config.general_config.secure_hash when loading the survey widget.",
        sample_user:   user.id,
        sample_input:  `${user.id}-${mask(settings.secureHashKey)}`,
        sample_output: widgetHashOutput,
        instructions: [
          "1. In CPX publisher dashboard → your app → Security settings",
          "2. Find 'Generate Secure Hash' and use your Supabase user UUID as ext_user_id",
          "3. Compare their output against sample_output above — they must match",
        ],
      },
      postback_hash: {
        formula:       "MD5(trans_id + '-' + secure_hash_key)",
        description:   "What CPX sends in the `hash` param on every postback. NOT the same as the widget hash.",
        sample_trans:  sampleTransId,
        sample_input:  `${sampleTransId}-${mask(settings.secureHashKey)}`,
        sample_output: postbackHashOutput,
        self_check:    postbackHashVerifies ? "PASS — our validator correctly verifies this hash" : "FAIL — hash validation is broken",
      },
    },

    postback: {
      template:      postbackTemplate,
      test_url:      testPostback,
      test_trans_id: testTransId,
      test_hash:     testHash,
      known_ips:     CPX_POSTBACK_IPS,
      warning:       "Hitting test_url will credit ~₦16 ($0.01) to YOUR account. Each test_url is unique (timestamped) so it can be used once without being blocked by dedup.",
    },
  })
}
