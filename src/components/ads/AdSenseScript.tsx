"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"

const ADSENSE_EXEMPT_PREFIXES = [
  "/admin",
  "/dashboard",
  "/sign-in",
  "/register",
  "/forgot-password",
  "/reset-password",
]

export function AdSenseScript() {
  const pathname = usePathname()

  if (ADSENSE_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  return (
    <Script
      id="google-adsense"
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3580627557521419"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}
