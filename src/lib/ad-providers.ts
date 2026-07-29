/**
 * Ad Providers — shared utilities for all rewarded ad integrations.
 *
 * Covers:
 *  - Daily cap enforcement (per-user, per-provider, UTC day window)
 *  - Session/transaction deduplication (idempotent postbacks)
 *  - Unified completion recorder (ad_task_logs + ledger + notification)
 *  - IMA SDK one-time HMAC token (generate + validate)
 *  - Postback signature validator for CPX (MD5)
 */

import { createHmac, createHash, timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendLedger } from "@/lib/ledger"
import { createNotification } from "@/lib/notifications"
import { recalcUserTier } from "@/lib/tiers"
import { getCpxSettings } from "@/lib/cpx"
import { getAsterraSettings } from "@/lib/asterra"

export type AdProvider = "ima" | "cpx" | "asterra"
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
    cpx: "survey",
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

// createHash is imported above; re-export for CPX postback route convenience.
export { createHash }

// ─── Settings Getters ─────────────────────────────────────────────────────────

/** Fetch all ad provider settings in one query. */
export async function getAdProviderSettings() {
  const admin = createAdminClient()
  const keys = [
    "ima_enabled", "ima_daily_cap", "ima_reward_kobo", "ima_ad_tag_url",
    "cpx_enabled", "cpx_daily_cap", "cpx_app_id", "cpx_secure_hash_key",
    "asterra_enabled", "asterra_daily_cap", "asterra_reward_kobo", "asterra_smartlink_url",
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
    cpx: {
      enabled:       Boolean(s.cpx_enabled          ?? false),
      dailyCap:      Number(s.cpx_daily_cap          ?? 10),
      appId:         String(s.cpx_app_id             ?? ""),
      secureHashKey: String(s.cpx_secure_hash_key    ?? ""),
    },
    asterra: {
      enabled:      Boolean(s.asterra_enabled      ?? false),
      dailyCap:     Number(s.asterra_daily_cap      ?? 3),
      rewardKobo:   Number(s.asterra_reward_kobo    ?? 250),
      smartlinkUrl: String(s.asterra_smartlink_url  ?? ""),
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
  const [ima, cpx, asterra] = await Promise.all([
    getAdProviderSettings().then((s) => s.ima),
    getCpxSettings(),
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
  if (asterra.enabled && asterra.smartlinkUrl) {
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
