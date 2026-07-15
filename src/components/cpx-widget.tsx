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

import { useEffect } from "react"

interface CpxWidgetProps {
  appId: string
  userId: string
  /** MD5(userId + '-' + secureHashKey) — computed server-side */
  secureHash: string
  username: string
  email: string
}

const DIV_ID     = "cpx-survey-wall"
const SCRIPT_ID  = "cpx-script-tag"
const SCRIPT_SRC = "https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js"

export function CpxWidget({ appId, userId, secureHash, username, email }: CpxWidgetProps) {
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

    // Step 2: append the CPX library script tag once (avoid duplicates on re-render)
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script")
      script.id   = SCRIPT_ID
      script.type = "text/javascript"
      script.src  = SCRIPT_SRC
      document.body.appendChild(script)
    } else {
      // Script already loaded from a previous render — trigger re-init if CPX exposes it
      ;(window as any).CpxResearch?.init?.()
    }
  }, [appId, userId, secureHash, username, email])

  return (
    <div
      id={DIV_ID}
      className="w-full"
      style={{ minHeight: 400 }}
    />
  )
}
