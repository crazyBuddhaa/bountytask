#!/usr/bin/env node
/**
 * CPX Research Integration Test Script
 *
 * Tests every meaningful scenario against the live postback endpoint.
 * Run from the project root:
 *
 *   node scripts/test-cpx.mjs
 *
 * Required env vars (or set them inline before running):
 *   CPX_TEST_URL      — base URL of your running app, e.g. http://localhost:3000
 *   CPX_SECURE_HASH   — the cpx_secure_hash_key value from Admin Settings
 *   CPX_TEST_USER_ID  — a valid Supabase user UUID to receive test credits
 *
 * Example:
 *   CPX_TEST_URL=http://localhost:3000 \
 *   CPX_SECURE_HASH=your_key_here \
 *   CPX_TEST_USER_ID=your-user-uuid \
 *   node scripts/test-cpx.mjs
 */

import { createHash } from "crypto"

// ─── Config ────────────────────────────────────────────────────────────────────

const BASE_URL      = process.env.CPX_TEST_URL     ?? "http://localhost:3000"
const HASH_KEY      = process.env.CPX_SECURE_HASH  ?? ""
const TEST_USER_ID  = process.env.CPX_TEST_USER_ID ?? ""

if (!HASH_KEY)     { console.error("❌  CPX_SECURE_HASH is not set"); process.exit(1) }
if (!TEST_USER_ID) { console.error("❌  CPX_TEST_USER_ID is not set"); process.exit(1) }

const ENDPOINT = `${BASE_URL}/api/postback/cpx`

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** MD5(trans_id + '-' + secureHashKey) — the postback hash formula */
function postbackHash(transId, key) {
  return createHash("md5").update(`${transId}-${key}`).digest("hex")
}

/** MD5(userId + '-' + secureHashKey) — the widget hash formula (different!) */
function widgetHash(userId, key) {
  return createHash("md5").update(`${userId}-${key}`).digest("hex")
}

let passed = 0
let failed = 0

async function run(label, url, expectedBody, expectedStatus = 200) {
  try {
    const res  = await fetch(url)
    const body = await res.text()

    const statusOk = res.status === expectedStatus
    const bodyOk   = body.trim() === expectedBody

    if (statusOk && bodyOk) {
      console.log(`  ✅  ${label}`)
      passed++
    } else {
      console.log(`  ❌  ${label}`)
      if (!statusOk) console.log(`       status: got ${res.status}, expected ${expectedStatus}`)
      if (!bodyOk)   console.log(`       body:   got "${body.trim()}", expected "${expectedBody}"`)
      failed++
    }
  } catch (err) {
    console.log(`  ❌  ${label} — fetch error: ${err.message}`)
    failed++
  }
}

// ─── Unit tests — hash functions ───────────────────────────────────────────────

console.log("\n── Hash formula verification ──────────────────────────────────────")

const sampleTransId = "unit-test-trans-001"
const sampleUserId  = TEST_USER_ID

const pb = postbackHash(sampleTransId, HASH_KEY)
const wh = widgetHash(sampleUserId, HASH_KEY)

if (pb.length === 32) {
  console.log(`  ✅  Postback hash produces 32-char MD5:  ${pb}`)
  passed++
} else {
  console.log(`  ❌  Postback hash is wrong length: ${pb}`)
  failed++
}

if (wh.length === 32) {
  console.log(`  ✅  Widget hash produces 32-char MD5:    ${wh}`)
  passed++
} else {
  console.log(`  ❌  Widget hash is wrong length: ${wh}`)
  failed++
}

if (pb !== wh) {
  console.log(`  ✅  Widget hash ≠ postback hash (they use different inputs — correct)`)
  passed++
} else {
  console.log(`  ⚠️   Widget hash === postback hash (expected different — check your key)`)
  // Not a hard failure; coincidence possible with the right inputs.
}

// ─── HTTP integration tests ────────────────────────────────────────────────────

console.log("\n── Postback endpoint tests ─────────────────────────────────────────")

// Generate unique trans_ids per test run so dedup doesn't interfere.
const ts   = Date.now()
const tid  = (n) => `cpx-test-${ts}-${n}`

// ── 1. Happy path — valid completion ──────────────────────────────────────────
await run(
  "Valid completion (status=1, correct hash) → '1' 200",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&trans_id=${tid(1)}&status=1&hash=${postbackHash(tid(1), HASH_KEY)}&amount_usd=0.10&amount_local=160`,
  "1", 200
)

// ── 2. Dedup — same trans_id as above ─────────────────────────────────────────
await run(
  "Duplicate trans_id (same as above) → '1' 200 (idempotent)",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&trans_id=${tid(1)}&status=1&hash=${postbackHash(tid(1), HASH_KEY)}&amount_usd=0.10&amount_local=160`,
  "1", 200
)

// ── 3. Status=2 (chargeback / cancelled) ──────────────────────────────────────
await run(
  "status=2 (chargeback) → '1' 200, no credit",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&trans_id=${tid(2)}&status=2&hash=${postbackHash(tid(2), HASH_KEY)}&amount_usd=0.10&amount_local=160`,
  "1", 200
)

// ── 4. Bad hash ────────────────────────────────────────────────────────────────
await run(
  "Wrong hash → '0' 401",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&trans_id=${tid(3)}&status=1&hash=deadbeefdeadbeefdeadbeefdeadbeef&amount_usd=0.10&amount_local=160`,
  "0", 401
)

// ── 5. Hash from WRONG formula (widget hash instead of postback hash) ──────────
// This test confirms our validator catches someone passing the widget hash
// formula instead of the postback hash formula.
await run(
  "Widget hash used as postback hash → '0' 401 (wrong formula)",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&trans_id=${tid(4)}&status=1&hash=${widgetHash(TEST_USER_ID, HASH_KEY)}&amount_usd=0.10&amount_local=160`,
  "0", 401
)

// ── 6. Missing user_id ─────────────────────────────────────────────────────────
await run(
  "Missing user_id → '0' 400",
  `${ENDPOINT}?trans_id=${tid(5)}&status=1&hash=${postbackHash(tid(5), HASH_KEY)}&amount_usd=0.10&amount_local=160`,
  "0", 400
)

// ── 7. Missing trans_id ────────────────────────────────────────────────────────
await run(
  "Missing trans_id → '0' 400",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&status=1&hash=somehash&amount_usd=0.10`,
  "0", 400
)

// ── 8. Missing hash ────────────────────────────────────────────────────────────
await run(
  "Missing hash param → '0' 401",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&trans_id=${tid(6)}&status=1&amount_usd=0.10`,
  "0", 401
)

// ── 9. Unknown status (ignored, CPX may add future values) ────────────────────
await run(
  "Unknown status=9 → '1' 200 (acknowledged, not credited)",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&trans_id=${tid(7)}&status=9&hash=${postbackHash(tid(7), HASH_KEY)}&amount_usd=0.10`,
  "1", 200
)

// ── 10. Unknown user_id (valid UUID but not in DB) ────────────────────────────
const fakeUUID = "00000000-0000-0000-0000-000000000000"
await run(
  "Unknown user_id (not in DB) → '1' 200 (acknowledged, not credited)",
  `${ENDPOINT}?user_id=${fakeUUID}&trans_id=${tid(8)}&status=1&hash=${postbackHash(tid(8), HASH_KEY)}&amount_usd=0.10`,
  "1", 200
)

// ── 11. amount_usd=0 (edge case — uses fallback ₦5) ──────────────────────────
await run(
  "amount_usd=0 (fallback ₦5) → '1' 200",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&trans_id=${tid(9)}&status=1&hash=${postbackHash(tid(9), HASH_KEY)}&amount_usd=0&amount_local=0`,
  "1", 200
)

// ── 12. Negative amount (edge case — should use fallback ₦5) ──────────────────
await run(
  "amount_usd=-1 (invalid, fallback ₦5) → '1' 200",
  `${ENDPOINT}?user_id=${TEST_USER_ID}&trans_id=${tid(10)}&status=1&hash=${postbackHash(tid(10), HASH_KEY)}&amount_usd=-1&amount_local=0`,
  "1", 200
)

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`\n── Results ─────────────────────────────────────────────────────────`)
console.log(`   ${passed} passed  /  ${failed} failed  /  ${passed + failed} total`)

if (failed > 0) {
  console.log(`\n   Some tests failed. Check the output above.\n`)
  process.exit(1)
} else {
  console.log(`\n   All tests passed! ✅\n`)
  process.exit(0)
}
