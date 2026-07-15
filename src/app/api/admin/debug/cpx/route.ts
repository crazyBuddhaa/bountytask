/**
 * Admin-only CPX diagnostic endpoint.
 *
 * GET /api/admin/debug/cpx
 *
 * Returns a full health-check of the CPX integration:
 *   - settings completeness
 *   - hash formula with a sample computation (verify against CPX dashboard)
 *   - postback URL template
 *   - a ready-to-fire test postback URL (status=1, $0.10)
 *
 * The secure hash key is never returned in plaintext — only a masked version
 * and a sample hash output are included so the caller can cross-check against
 * the CPX publisher dashboard without the key being logged.
 */
import { NextResponse }        from "next/server"
import { createClient }        from "@/lib/supabase/server"
import { createAdminClient }   from "@/lib/supabase/admin"
import { getCpxSettings, buildCpxSecureHash } from "@/lib/cpx"
import { createHash }          from "crypto"

const APP_URL = "https://bountytask.dpdns.org"

async function assertAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return !!data && ["admin", "super_admin"].includes(data.role)
}

/** Mask a string: show first 4 and last 4 chars, replace middle with ****. */
function mask(s: string): string {
  if (!s)          return "(empty)"
  if (s.length <= 8) return "*".repeat(s.length)
  return `${s.slice(0, 4)}****${s.slice(-4)}`
}

export const dynamic = "force-dynamic"

export async function GET() {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user)                      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ error: "Forbidden"    }, { status: 403 })

  // ── Settings ──────────────────────────────────────────────────────────────
  const settings = await getCpxSettings()

  // ── Hash diagnostics ──────────────────────────────────────────────────────
  // Use the calling admin's own user ID as the sample so they can cross-check
  // the output against what the CPX publisher dashboard shows for their account.
  const sampleUserId      = user.id
  const sampleHashInput   = `${sampleUserId}-${settings.secureHashKey}`
  const sampleHashOutput  = settings.secureHashKey
    ? buildCpxSecureHash(sampleUserId, settings.secureHashKey)
    : "(no key — hash not computed)"

  // ── Test postback URL ─────────────────────────────────────────────────────
  // A valid-looking test postback you can paste into a browser to verify the
  // route accepts it end-to-end. Uses a fixed test transId.
  const testTransId   = "cpx-debug-test-001"
  const testHash      = settings.secureHashKey
    ? createHash("md5").update(`${testTransId}-${settings.secureHashKey}`).digest("hex")
    : "(no key)"
  const testUserId    = user.id  // credits the admin's own account — amount is $0.01
  const testPostback  =
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
    cpx_enabled:       settings.enabled,
    has_app_id:        !!settings.appId,
    has_hash_key:      !!settings.secureHashKey,
    app_id_is_number:  !isNaN(Number(settings.appId)),
    daily_cap_nonzero: settings.dailyCap > 0,
  }

  const allPassed = Object.values(checks).every(Boolean)

  return NextResponse.json({
    status:    allPassed ? "ok" : "misconfigured",
    checks,

    settings: {
      enabled:    settings.enabled,
      app_id:     settings.appId    || "(empty)",
      hash_key:   mask(settings.secureHashKey),
      daily_cap:  settings.dailyCap,
    },

    hash_diagnostic: {
      formula:     "MD5(ext_user_id + '-' + secure_hash_key)",
      sample_user: sampleUserId,
      sample_input_pattern: `${sampleUserId}-${mask(settings.secureHashKey)}`,
      sample_output: sampleHashOutput,
      instructions: [
        "1. Log into your CPX Research publisher dashboard",
        "2. Navigate to your app → Security settings",
        "3. Generate the expected hash for your own user ID using their tool",
        "4. Compare against sample_output above — they must match",
        "5. If they differ, the formula or key stored here is wrong",
      ],
    },

    postback: {
      template:        postbackTemplate,
      test_url:        testPostback,
      test_trans_id:   testTransId,
      test_hash:       testHash,
      warning:         "Hitting test_url will credit ₦ to YOUR account (the admin). Use once to verify; the dedup system will block retries with the same trans_id.",
    },
  })
}
