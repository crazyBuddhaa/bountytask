"use client"

/**
 * MonetagScript — conditionally renders the Monetag Multitag ad script.
 *
 * This is a client component so it can read the current pathname via
 * usePathname(). Admin and authenticated dashboard pages are exempt from
 * all Monetag ads: pop-unders, in-page push, and vignette banners must not
 * fire while a user is navigating the sidebar or working in the admin panel.
 *
 * Ads are shown only on public-facing pages (landing, about, FAQ, contact,
 * advertise, auth pages, etc.).
 */

import Script from "next/script"
import { usePathname } from "next/navigation"
import type { ParsedMonetagSnippet } from "@/lib/monetag"

/**
 * Path prefixes that are permanently exempt from Monetag ads.
 * Any pathname that starts with one of these receives no ad scripts.
 *
 * /admin  — admins should never see pop-unders or push ads while working.
 * /dashboard is intentionally NOT listed: ads run on dashboard pages, but
 * sidebar link clicks are shielded via stopPropagation in DashboardSidebar.
 */
const AD_EXEMPT_PREFIXES = [
  "/admin",
]

interface MonetagScriptProps {
  multitag: ParsedMonetagSnippet
}

export function MonetagScript({ multitag }: MonetagScriptProps) {
  const pathname = usePathname()

  // Suppress all Monetag ads on admin and dashboard routes.
  if (AD_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  if (multitag.kind === "src") {
    return (
      <Script
        id="monetag-multitag"
        src={multitag.src}
        strategy="afterInteractive"
        data-zone={multitag.dataZone}
        data-cfasync={multitag.dataCfasync}
      />
    )
  }

  if (multitag.kind === "inline") {
    return (
      <Script
        id="monetag-multitag"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: multitag.js }}
      />
    )
  }

  return null
}
