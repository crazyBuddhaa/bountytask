"use client"
/**
 * CPX Research Script Tag Widget
 *
 * Loads the CPX Research JS library and renders the full-content survey wall
 * inside a div on the page.
 *
 * The secure hash is computed server-side and passed as a prop so the
 * secureHashKey is never exposed to the browser.
 *
 * How it works:
 *  1. Sets window.config with the user-specific general_config before the
 *     CPX library script runs (CPX reads window.config on init).
 *  2. Dynamically appends the CPX library <script> tag to <body>.
 *  3. Renders the target <div> that CPX populates with the survey list.
 */

import { useEffect, useRef } from "react"

interface CpxWidgetProps {
  appId: string
  userId: string
  /** MD5(userId + '-' + secureHashKey) — computed server-side */
  secureHash: string
  username: string
  email: string
}

const DIV_ID     = "cpx-survey-wall"
const SCRIPT_SRC = "https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js"

export function CpxWidget({ appId, userId, secureHash, username, email }: CpxWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Step 1: write window.config BEFORE the library loads
    // (CPX reads this object on initialisation)
    ;(window as any).config = {
      general_config: {
        app_id:       Number(appId), // CPX docs specify this must be a number, not a string
        ext_user_id:  userId,
        secure_hash:  secureHash,
        username,
        email,
        subid_1:      "bountytask",
      },
      style_config: {},
      script_config: [
        {
          div_id:        DIV_ID,
          theme_style:   1,   // Design 1 — Full Content Widget (best for a dedicated surveys page)
          order_by:      2,   // 1 = best score, 2 = best money, 3 = best conversion rate
          limit_surveys: 12,
        },
      ],
    }

    // Step 2: (re-)inject the CPX library script tag.
    // CPX's library reads window.config once, at script-execution time, and
    // paints the survey list into the target div right then — it exposes no
    // public re-init API (confirmed: no `window.CpxResearch` global exists
    // anywhere in the bundle). Because this is an SPA, the previously
    // injected <script> tag survives client-side navigation, so skipping
    // re-injection when a tag with this id already exists left the survey
    // wall empty on every visit after the first. Always strip any previous
    // instance and its rendered content, then inject a fresh script tag so
    // it re-reads the current window.config and re-renders on every mount.
    document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`).forEach((el) => el.remove())
    if (containerRef.current) containerRef.current.innerHTML = ""

    const script = document.createElement("script")
    script.type = "text/javascript"
    script.src  = SCRIPT_SRC
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [appId, userId, secureHash, username, email])

  return (
    <div
      ref={containerRef}
      id={DIV_ID}
      className="w-full"
      style={{ minHeight: 400 }}
    />
  )
}
