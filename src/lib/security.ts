import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import type { UserRole } from "@/types"

/**
 * Constant-time string comparison using SHA-256 digests so lengths never leak.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest()
  const hashB = crypto.createHash("sha256").update(b).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

/**
 * Verify x-cron-secret header against process.env.CRON_SECRET.
 * Fails closed when CRON_SECRET is missing or empty.
 */
export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const provided = request.headers.get("x-cron-secret")
  if (!provided) return false
  return timingSafeStringEqual(provided, expected)
}

/**
 * Verify that userId belongs to an ACTIVE admin or super_admin.
 */
export async function getActiveAdminRole(
  userId: string
): Promise<{ isAdmin: boolean; isSuperAdmin: boolean; role: UserRole | null }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("users")
    .select("role, is_active")
    .eq("id", userId)
    .single()

  if (!data || !data.is_active) {
    return { isAdmin: false, isSuperAdmin: false, role: null }
  }

  const role = data.role as UserRole
  const isSuperAdmin = role === "super_admin"
  const isAdmin = role === "admin" || isSuperAdmin
  return { isAdmin, isSuperAdmin, role }
}

/**
 * Validate a relative redirect path to prevent open redirects.
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!raw || typeof raw !== "string") return fallback
  const trimmed = raw.trim()
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("@") ||
    trimmed.includes("://") ||
    /[\r\n]/.test(trimmed)
  ) {
    return fallback
  }
  return trimmed
}

/**
 * Safely parse boolean platform_settings values that may be stored as
 * JSON booleans or strings ("true"/"false"). Avoids Boolean("false") === true.
 */
export function parseBoolSetting(value: unknown, fallback = false): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true
  if (value === false || value === "false" || value === 0 || value === "0") return false
  return fallback
}

/**
 * Safely parse pagination query parameters with bounded defaults.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit = 100
): { page: number; limit: number } {
  const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10)
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? String(defaultLimit), 10)
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit
  return { page, limit }
}

/**
 * Strip PostgREST filter syntax characters from a user search term before
 * interpolating into `.or(...)`.
 */
export function sanitizePostgrestSearch(raw: string): string {
  return raw.replace(/[,()%*\\]/g, " ").trim().slice(0, 100)
}

/**
 * Check if a hostname looks like a private/loopback/link-local/metadata IP or host.
 */
function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "metadata.google.internal" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true
  }
  // IPv4 private / loopback / link-local / CGNAT ranges
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return true
    }
  }
  // IPv6 loopback/ULA/link-local
  if (h.includes(":")) {
    if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h === "::") {
      return true
    }
  }
  return false
}

/**
 * Validate a public HTTPS URL (and optional hostname allowlist) against SSRF.
 */
export function isSafePublicHttpsUrl(
  raw: string,
  allowedHostSuffixes?: string[]
): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:") return false
    if (url.username || url.password) return false
    if (isPrivateOrLocalHost(url.hostname)) return false
    if (allowedHostSuffixes && allowedHostSuffixes.length > 0) {
      const host = url.hostname.toLowerCase()
      return allowedHostSuffixes.some(
        (suffix) => host === suffix || host.endsWith(`.${suffix}`)
      )
    }
    return true
  } catch {
    return false
  }
}

/**
 * Validate that a proof or avatar URL points to our trusted storage origins
 * (Cloudinary or this project's Supabase Storage).
 */
export function isTrustedUploadUrl(raw: string): boolean {
  const allowedHosts: string[] = ["res.cloudinary.com"]
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    try {
      allowedHosts.push(new URL(supabaseUrl).hostname.toLowerCase())
    } catch {
      // ignore malformed env
    }
  }
  return isSafePublicHttpsUrl(raw, allowedHosts)
}

/**
 * Detect MIME type from file header magic bytes to prevent Content-Type spoofing.
 */
export function detectMimeFromMagicBytes(buf: Buffer): string | null {
  if (buf.length < 12) return null

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg"
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png"
  }
  // GIF: GIF87a / GIF89a
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return "image/gif"
  }
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp"
  }
  // PDF: %PDF-
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf"
  }
  // MP4 / ISO BMFF: ....ftyp
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    return "video/mp4"
  }

  return null
}

/**
 * Simple in-memory sliding-window rate limiter for single-instance / warm-lambda
 * defense-in-depth (e.g., bank resolve, analytics endpoints).
 */
const rateLimitBuckets = new Map<string, number[]>()

export function checkInMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()
  const cutoff = now - windowMs
  const existing = (rateLimitBuckets.get(key) ?? []).filter((ts) => ts > cutoff)

  if (existing.length >= maxRequests) {
    const oldest = existing[0] ?? now
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    rateLimitBuckets.set(key, existing)
    return { allowed: false, retryAfterSec }
  }

  existing.push(now)
  rateLimitBuckets.set(key, existing)
  // Prevent unbounded memory growth
  if (rateLimitBuckets.size > 5000) {
    const firstKey = rateLimitBuckets.keys().next().value
    if (firstKey) rateLimitBuckets.delete(firstKey)
  }
  return { allowed: true, retryAfterSec: 0 }
}
