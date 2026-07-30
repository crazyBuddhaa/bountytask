/**
 * Games section layout.
 *
 * The Monetag games interstitial that was previously injected here has been
 * removed. All /dashboard/* routes — including /dashboard/games/* — are
 * exempt from Monetag ads so that navigating the sidebar and moving between
 * game pages never triggers pop-unders or interstitial ads.
 *
 * Ads run only on public-facing pages (landing, about, FAQ, contact, etc.).
 * See src/components/ads/MonetagScript.tsx for the exemption logic.
 */

export default function GamesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
