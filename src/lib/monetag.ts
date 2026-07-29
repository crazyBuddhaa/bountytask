/**
 * Monetag ad network — publisher-side settings.
 *
 * Monetag is a display/passive ad network (formerly PropellerAds).
 * It operates on an aggregate CPM model: no per-user postbacks exist.
 * Revenue is earned on traffic volume and reported in the Monetag dashboard.
 *
 * Two integration surfaces:
 *  1. Sitewide Multitag — admin pastes the Multitag <script> snippet from the
 *     Monetag publisher dashboard. Injected into <head> on every page. Handles
 *     passive formats: OnClick popunder, In-Page Push, Vignette Banner.
 *     Runs alongside AdSense and Adsterra on the same pages.
 *
 *  2. Games interstitial — admin pastes a separate zone script. Injected into
 *     the games section layout so it fires on each games page navigation.
 *     Full-screen interstitial between game sessions.
 *
 * No rewards are credited to users for these — they are passive revenue formats
 * that monetize traffic, not user-action tasks. The existing service worker
 * (public/sw_*.js) handles Monetag Multitag verification automatically.
 *
 * Script snippet formats supported by parseMonetagSnippet():
 *  - External src tag:  <script src="https://..." data-zone="123" ...></script>
 *  - Inline JS tag:     <script>(function(a,b,...){...})()</script>
 *  - Raw inline JS:     (function(a,b,...){...})()
 */
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"

export type MonetagSettings = {
  /** Master toggle for sitewide Multitag script. */
  enabled: boolean
  /** Full <script> snippet copied from Monetag dashboard → Ad Channels. */
  multitag_script: string
  /** Toggle for the games-only interstitial zone. */
  games_interstitial_enabled: boolean
  /** Full <script> snippet for the interstitial zone (games pages only). */
  games_interstitial_script: string
}

/**
 * Parsed representation of a Monetag script snippet.
 *
 * - `src`    — an external script (<script src="..." data-zone="..." ...>)
 * - `inline` — raw JavaScript to inject via dangerouslySetInnerHTML
 * - `empty`  — blank/missing snippet; nothing should be rendered
 */
export type ParsedMonetagSnippet =
  | { kind: "src"; src: string; dataZone?: string; dataCfasync?: string }
  | { kind: "inline"; js: string }
  | { kind: "empty" }

/**
 * Parse a Monetag script snippet pasted by the admin into one of three forms:
 *
 * 1. External src tag  →  { kind: "src", src, dataZone?, dataCfasync? }
 *    e.g. <script src="https://quge5.com/88/tag.min.js" data-zone="265156" async data-cfasync="false"></script>
 *
 * 2. Inline JS  →  { kind: "inline", js }
 *    e.g. <script>(function(a,b,c,d){...})()</script>   or just raw JS without a wrapper tag.
 *
 * 3. Empty  →  { kind: "empty" }
 *    Blank string; caller should render nothing.
 *
 * The old stripScriptTags() approach only handled inline JS. This replaces it.
 */
export function parseMonetagSnippet(snippet: string): ParsedMonetagSnippet {
  const trimmed = snippet.trim()
  if (!trimmed) return { kind: "empty" }

  // ── Detect an external src-based <script> tag ────────────────────────────
  //   Matches: <script ... src="https://..." ... >
  const srcMatch = trimmed.match(/^<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i)
  if (srcMatch) {
    const src = srcMatch[1]
    const zoneMatch  = trimmed.match(/\bdata-zone=["']([^"']+)["']/i)
    const cfasyncMatch = trimmed.match(/\bdata-cfasync=["']([^"']+)["']/i)
    return {
      kind: "src",
      src,
      dataZone:    zoneMatch    ? zoneMatch[1]    : undefined,
      dataCfasync: cfasyncMatch ? cfasyncMatch[1] : undefined,
    }
  }

  // ── Strip <script> wrapper and treat the inner content as inline JS ──────
  const inner = trimmed
    .replace(/^<script[^>]*>/i, "")
    .replace(/<\/script>$/i, "")
    .trim()

  if (inner) return { kind: "inline", js: inner }

  // A <script> tag with no src and no inner content — nothing to render.
  return { kind: "empty" }
}

async function _getMonetagSettings(): Promise<MonetagSettings> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", [
      "monetag_enabled",
      "monetag_multitag_script",
      "monetag_games_interstitial_enabled",
      "monetag_games_interstitial_script",
    ])

  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))

  return {
    enabled:                    Boolean(s.monetag_enabled                    ?? false),
    multitag_script:            String( s.monetag_multitag_script            ?? ""),
    games_interstitial_enabled: Boolean(s.monetag_games_interstitial_enabled ?? false),
    games_interstitial_script:  String( s.monetag_games_interstitial_script  ?? ""),
  }
}

/**
 * Cached settings read (60-second TTL).
 * Call revalidateTag("monetag-settings") after admin writes to apply immediately.
 */
export const getMonetagSettings = unstable_cache(
  _getMonetagSettings,
  ["monetag-settings"],
  { revalidate: 60, tags: ["monetag-settings"] }
)
