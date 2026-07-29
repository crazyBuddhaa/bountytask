/**
 * Games section layout.
 *
 * Injects the Monetag interstitial ad script when the feature is enabled.
 * The interstitial zone fires between game page navigations — exactly what
 * we want: an ad between sessions, not interrupting active gameplay.
 *
 * The script is fetched server-side (cached 60 s) and injected as a
 * Next.js Script so it runs in the browser after hydration.
 * Using strategy="afterInteractive" keeps it out of the critical path
 * while still loading early enough to be ready before the next navigation.
 *
 * Supports both external src-based snippets and inline JS snippets via
 * parseMonetagSnippet() — the old stripScriptTags() approach only handled
 * inline JS and silently produced nothing for src-based tags.
 */
import Script from "next/script"
import { getMonetagSettings, parseMonetagSnippet } from "@/lib/monetag"

export default async function GamesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const monetag = await getMonetagSettings()

  // Parse the admin-pasted snippet into a typed structure.
  const interstitial =
    monetag.games_interstitial_enabled &&
    monetag.games_interstitial_script.trim().length > 0
      ? parseMonetagSnippet(monetag.games_interstitial_script)
      : { kind: "empty" as const }

  return (
    <>
      {/* External src-based interstitial (e.g. Monetag zone tag with data-zone attr) */}
      {interstitial.kind === "src" && (
        <Script
          id="monetag-games-interstitial"
          src={interstitial.src}
          strategy="afterInteractive"
          data-zone={interstitial.dataZone}
          data-cfasync={interstitial.dataCfasync}
        />
      )}
      {/* Inline JS interstitial (legacy / alternative Monetag format) */}
      {interstitial.kind === "inline" && (
        <Script
          id="monetag-games-interstitial"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: interstitial.js }}
        />
      )}
      {children}
    </>
  )
}
