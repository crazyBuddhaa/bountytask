/**
 * Ad Providers — shared utilities for all rewarded ad integrations.
 *
 * Covers:
 *  - Daily cap enforcement (per-user, per-provider, UTC day window)
 *  - Session/transaction deduplication (idempotent postbacks)
 *  - Unified completion recorder (ad_task_logs + ledger + notification)
 *  - IMA SDK one-time HMAC token (generate + validate)
 *  - Postback signature validators for Ayet (HMAC-SHA256), CPX (MD5),
 *    and Lootably (HMAC-SHA256)
 */

import { createHmac, createHash, timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendLedger } from "@/lib/ledger"
import { createNotification } from "@/lib/notifications"
import { recalcUserTier } from "@/lib/tiers"
import { getAyetSettings } from "@/lib/ayet"
import { getCpxSettings } from "@/lib/cpx"
import { getLootablySettings } from "@/lib/lootably"
import { getAdGateSettings } from "@/lib/adgate"
import { getAsterraSettings } from "@/lib/asterra"

export type AdProvider = "ima" | "lootably" | "ayet" | "cpx" | "adgate" | "asterra"
export type AdType = "video" | "survey" | "offer" | "mixed"

// ─── Daily Cap ────────────────────────────────────────────────────────────────

/** Count ad completions for a user + provider since UTC midnight today. */
export async function getAdCompletionsTodayCount(
  userId: string,
  provider: AdProvider
): Promise<number> {
  const admin = createAdminClient()
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count } = await admin
    .from("ad_task_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", provider)
    .gte("completed_at", startOfDay.toISOString())

  return count ?? 0
}

/** Returns whether the user has hit the daily cap for this provider. */
export async function checkAdDailyCap(
  userId: string,
  provider: AdProvider,
  cap: number
): Promise<{ limited: boolean; used: number; cap: number }> {
  const used = await getAdCompletionsTodayCount(userId, provider)
  return { limited: used >= cap, used, cap }
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Returns true if this (provider, sessionId) pair has already been credited.
 * Call this before recordAdCompletion to avoid double-crediting replayed postbacks.
 * The unique partial index on ad_task_logs also enforces this at the DB level.
 */
export async function isAdSessionDuplicate(
  provider: AdProvider,
  sessionId: string
): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("ad_task_logs")
    .select("id")
    .eq("provider", provider)
    .eq("session_id", sessionId)
    .limit(1)
  return (data?.length ?? 0) > 0
}

// ─── Unified Completion Recorder ──────────────────────────────────────────────

/**
 * Record a verified ad task completion:
 *  1. Inserts a row into ad_task_logs (unique index prevents duplicates at DB level)
 *  2. Appends a ledger credit entry
 *  3. Sends an in-app notification to the user
 *
 * Always call isAdSessionDuplicate + checkAdDailyCap before this function.
 */
export async function recordAdCompletion({
  userId,
  provider,
  adType,
  rewardKobo,
  sessionId,
}: {
  userId: string
  provider: AdProvider
  adType: AdType
  rewardKobo: number
  sessionId?: string
}) {
  const admin = createAdminClient()

  const { error: logError } = await admin.from("ad_task_logs").insert({
    user_id: userId,
    provider,
    ad_type: adType,
    reward_kobo: rewardKobo,
    session_id: sessionId ?? null,
  })

  // Unique index violation = duplicate session. Treat as already processed.
  if (logError) {
    if (logError.code === "23505") return null // duplicate — already credited
    throw new Error(`ad_task_logs insert failed: ${logError.message}`)
  }

  const ledgerEntry = await appendLedger({
    userId,
    type: "credit",
    delta: rewardKobo,
    refType: "task_reward",
    note: `Ad task reward — ${provider} (${adType})`,
  })

  const naira = (rewardKobo / 100).toFixed(2)
  const providerLabel: Record<AdProvider, string> = {
    ima: "video ad",
    lootably: "offer",
    ayet: "survey/offer",
    cpx: "survey",
    adgate: "offer",
    asterra: "smartlink offer",
  }

  await createNotification({
    userId,
    type: "task_approved",
    title: "Ad Task Completed! 🎯",
    message: `₦${naira} credited for completing a ${providerLabel[provider]}.`,
    refId: ledgerEntry.id,
  })

  // Ad completions count toward tier advancement the same as regular tasks.
  await recalcUserTier(userId)

  return ledgerEntry
}

// ─── IMA SDK One-Time Token ───────────────────────────────────────────────────

// We reuse CRON_SECRET as the HMAC key so no extra env var is needed.
// In production, consider a dedicated IMA_TOKEN_SECRET env var.
const IMA_SECRET = process.env.CRON_SECRET ?? "ima-dev-fallback-secret"

/**
 * Generate a short-lived (10 min) HMAC-signed token for an IMA ad session.
 * The token encodes the userId and expiry so the complete endpoint can
 * validate it without any DB lookup.
 *
 * Format: `<userId>:<expiresMs>:<hmac>`
 */
export function generateImaToken(userId: string): string {
  const expires = Date.now() + 10 * 60 * 1000
  const payload = `${userId}:${expires}`
  const sig = createHmac("sha256", IMA_SECRET).update(payload).digest("hex")
  return Buffer.from(`${payload}:${sig}`).toString("base64url")
}

/**
 * Validate an IMA token. Returns the userId if valid and not expired.
 * Returns null if the token is malformed, expired, or tampered.
 */
export function validateImaToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8")
    const parts = decoded.split(":")
    if (parts.length !== 3) return null
    const [userId, expiresStr, sig] = parts
    const expires = parseInt(expiresStr, 10)
    if (isNaN(expires) || Date.now() > expires) return null
    const payload = `${userId}:${expires}`
    const expected = createHmac("sha256", IMA_SECRET).update(payload).digest("hex")
    // Timing-safe comparison to prevent timing attacks
    const sigBuf = Buffer.from(sig, "hex")
    const expBuf = Buffer.from(expected, "hex")
    if (sigBuf.length !== expBuf.length) return null
    if (!timingSafeEqual(sigBuf, expBuf)) return null
    return userId
  } catch {
    return null
  }
}

// ─── Postback Signature Validators ───────────────────────────────────────────

/**
 * Ayet Studios: HMAC-SHA256 over sorted `key=value` pairs (excluding `sig`).
 * Ayet sorts all postback params alphabetically, joins with `&`, then signs.
 */
export function validateAyetSignature(
  params: Record<string, string>,
  secretKey: string
): boolean {
  const receivedSig = params["sig"]
  if (!receivedSig) return false
  const sorted = Object.keys(params)
    .filter((k) => k !== "sig")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")
  const expected = createHmac("sha256", secretKey).update(sorted).digest("hex")
  try {
    return timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expected))
  } catch {
    // Different-length buffers (e.g. malformed/forged sig) throw instead of
    // returning false — treat as an invalid signature, not a server error.
    return false
  }
}

/**
 * CPX Research: MD5(`appId-userId-transactionId-secureHashKey`)
 * CPX sends `hash` as a query parameter on the postback.
 */
export function validateCpxHash(
  appId: string,
  userId: string,
  transactionId: string,
  secureHashKey: string,
  receivedHash: string
): boolean {
  const raw = `${appId}-${userId}-${transactionId}-${secureHashKey}`
  const expected = createHash("md5").update(raw).digest("hex")
  try {
    return timingSafeEqual(Buffer.from(receivedHash), Buffer.from(expected))
  } catch {
    return false
  }
}

/**
 * Lootably: HMAC-SHA256(secret, userId + transactionId)
 * Lootably sends `sig` as a query parameter on the postback.
 */
export function validateLootablySignature(
  userId: string,
  transactionId: string,
  secret: string,
  receivedSig: string
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${userId}${transactionId}`)
    .digest("hex")
  try {
    return timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expected))
  } catch {
    return false
  }
}

/**
 * AdGate Media verifies postbacks by source IP rather than a signed hash
 * (their panel shows the sending IP under the wall's Postback section).
 * Constant-time-ish string compare is unnecessary here — IPs aren't secret,
 * this just guards against stray/forged callers.
 */
export function validateAdGatePostbackIp(requestIp: string | undefined, configuredIp: string): boolean {
  if (!requestIp || !configuredIp) return false
  return requestIp === configuredIp
}

// ─── Settings Getters ─────────────────────────────────────────────────────────

/** Fetch all ad provider settings in one query. */
export async function getAdProviderSettings() {
  const admin = createAdminClient()
  const keys = [
    "ima_enabled", "ima_daily_cap", "ima_reward_kobo", "ima_ad_tag_url",
    "lootably_enabled", "lootably_daily_cap", "lootably_api_key", "lootably_secret",
    "ayet_enabled", "ayet_daily_cap", "ayet_placement_key", "ayet_secret_key",
    "cpx_enabled", "cpx_daily_cap", "cpx_app_id", "cpx_secure_hash_key",
    "adgate_enabled", "adgate_daily_cap", "adgate_wall_id", "adgate_postback_ip",
    "asterra_enabled", "asterra_daily_cap", "asterra_smartlink_url", "asterra_secret_key",
  ] as const

  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", keys)

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))

  return {
    ima: {
      enabled:    Boolean(s.ima_enabled    ?? false),
      dailyCap:   Number(s.ima_daily_cap   ?? 2),
      rewardKobo: Number(s.ima_reward_kobo ?? 50),
      adTagUrl:   String(s.ima_ad_tag_url  ?? ""),
    },
    lootably: {
      enabled:    Boolean(s.lootably_enabled   ?? false),
      dailyCap:   Number(s.lootably_daily_cap  ?? 10),
      apiKey:     String(s.lootably_api_key    ?? ""),
      secret:     String(s.lootably_secret     ?? ""),
    },
    ayet: {
      enabled:      Boolean(s.ayet_enabled       ?? false),
      dailyCap:     Number(s.ayet_daily_cap       ?? 10),
      placementKey: String(s.ayet_placement_key   ?? ""),
      secretKey:    String(s.ayet_secret_key      ?? ""),
    },
    cpx: {
      enabled:       Boolean(s.cpx_enabled          ?? false),
      dailyCap:      Number(s.cpx_daily_cap          ?? 10),
      appId:         String(s.cpx_app_id             ?? ""),
      secureHashKey: String(s.cpx_secure_hash_key    ?? ""),
    },
    adgate: {
      enabled:    Boolean(s.adgate_enabled    ?? false),
      dailyCap:   Number(s.adgate_daily_cap   ?? 10),
      wallId:     String(s.adgate_wall_id     ?? ""),
      postbackIp: String(s.adgate_postback_ip ?? ""),
    },
    asterra: {
      enabled:      Boolean(s.asterra_enabled      ?? false),
      dailyCap:     Number(s.asterra_daily_cap      ?? 10),
      smartlinkUrl: String(s.asterra_smartlink_url  ?? ""),
      secretKey:    String(s.asterra_secret_key     ?? ""),
    },
  }
}

export interface AdTaskStatus {
  provider: AdProvider
  title: string
  description: string
  href: string
  /** Fixed reward in kobo, or null when the reward varies per offer (set by the ad network). */
  rewardKobo: number | null
  dailyCap: number
  usedToday: number
  capReached: boolean
}

/**
 * Ad-task cards for the Available Tasks grid — one entry per provider that
 * is enabled AND fully configured, with today's usage against its cap.
 * Only enabled providers are returned; disabled/unconfigured ones are
 * omitted entirely rather than shown as "coming soon" in the main grid.
 */
export async function getAdTaskStatusForUser(userId: string): Promise<AdTaskStatus[]> {
  const [ima, lootably, ayet, cpx, adgate, asterra] = await Promise.all([
    getAdProviderSettings().then((s) => s.ima),
    getLootablySettings(),
    getAyetSettings(),
    getCpxSettings(),
    getAdGateSettings(),
    getAsterraSettings(),
  ])

  const candidates: Omit<AdTaskStatus, "usedToday" | "capReached">[] = []

  if (ima.enabled && ima.adTagUrl) {
    candidates.push({
      provider: "ima",
      title: "Watch a Video Ad",
      description: "Watch a short rewarded video ad to completion for an instant payout.",
      href: "/dashboard/tasks/watch-ad",
      rewardKobo: ima.rewardKobo,
      dailyCap: ima.dailyCap,
    })
  }
  if (lootably.enabled && lootably.apiKey && lootably.secret) {
    candidates.push({
      provider: "lootably",
      title: "Offers & Rewards",
      description: "Complete offers, games, and surveys from the mixed rewards wall.",
      href: "/dashboard/tasks/mixed-offers",
      rewardKobo: null,
      dailyCap: lootably.dailyCap,
    })
  }
  if (ayet.enabled && ayet.placementKey && ayet.secretKey) {
    candidates.push({
      provider: "ayet",
      title: "Surveys & Offers",
      description: "Complete surveys, sign-ups, and offers from verified advertisers.",
      href: "/dashboard/tasks/offers",
      rewardKobo: null,
      dailyCap: ayet.dailyCap,
    })
  }
  if (cpx.enabled && cpx.appId && cpx.secureHashKey) {
    candidates.push({
      provider: "cpx",
      title: "Take a Survey",
      description: "Answer a short survey for an instant payout.",
      href: "/dashboard/tasks/surveys",
      rewardKobo: null,
      dailyCap: cpx.dailyCap,
    })
  }
  if (adgate.enabled && adgate.wallId && adgate.postbackIp) {
    candidates.push({
      provider: "adgate",
      title: "AdGate Rewards Wall",
      description: "Complete offers, app installs, and sign-ups from the AdGate rewards wall.",
      href: "/dashboard/tasks/adgate-offers",
      rewardKobo: null,
      dailyCap: adgate.dailyCap,
    })
  }
  if (asterra.enabled && asterra.smartlinkUrl && asterra.secretKey) {
    candidates.push({
      provider: "asterra",
      title: "Asterra Smartlink",
      description: "Complete offers, surveys, and app installs — Asterra auto-selects the best offer for you.",
      href: "/dashboard/tasks/smartlink",
      rewardKobo: null,
      dailyCap: asterra.dailyCap,
    })
  }

  const withUsage = await Promise.all(
    candidates.map(async (c) => {
      const usedToday = await getAdCompletionsTodayCount(userId, c.provider)
      return { ...c, usedToday, capReached: usedToday >= c.dailyCap }
    })
  )

  return withUsage
}
