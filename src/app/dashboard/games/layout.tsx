/**
 * Games section layout.
 *
 * Injects the Monetag interstitial ad script when the feature is enabled.
 * The interstitial zone fires between game page navigations — exactly what
 * we want: an ad between sessions, not interrupting active gameplay.
 *
 * The script is fetched server-side (cached 60 s) and injected as an
 * inline Next.js Script so it runs in the browser after hydration.
 * Using strategy="afterInteractive" keeps it out of the critical path
 * while still loading early enough to be ready before the next navigation.
 */
import Script from "next/script"
import { getMonetagSettings } from "@/lib/monetag"

export default async function GamesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const monetag = await getMonetagSettings()

  const showInterstitial =
    monetag.games_interstitial_enabled &&
    monetag.games_interstitial_script.trim().length > 0

  // Strip surrounding <script> tags if the admin pasted the full HTML tag;
  // Next.js Script with dangerouslySetInnerHTML expects raw JS, not an HTML tag.
  const interstitialJs = showInterstitial
    ? stripScriptTags(monetag.games_interstitial_script)
    : ""

  return (
    <>
      {showInterstitial && interstitialJs && (
        <Script
          id="monetag-games-interstitial"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: interstitialJs }}
        />
      )}
      {children}
    </>
  )
}

/**
 * Remove wrapping <script ...> ... </script> tags from a pasted snippet,
 * leaving only the inner JavaScript so Next.js Script can handle it.
 * If the snippet has no <script> wrapper, it is returned as-is.
 */
function stripScriptTags(snippet: string): string {
  const trimmed = snippet.trim()
  const inner = trimmed
    .replace(/^<script[^>]*>/i, "")
    .replace(/<\/script>$/i, "")
    .trim()
  return inner
}
