"use client"
/**
 * CPX Research Script Tag Widget
 *
 * Loads the CPX Research JS library and renders the full-content survey wall
 * inline on the page.
 *
 * The secure hash is computed server-side and passed as a prop so the
 * secureHashKey is never exposed to the browser.
 *
 * How it works:
 *  1. Sets window.config with the user-specific general_config before the
 *     CPX library script runs (CPX reads window.config on init).
 *  2. Strips any previous CPX script tag + clears the target div, then
 *     appends a fresh <script> tag each mount.
 *
 * Why fresh injection on every mount:
 *  CPX's library reads window.config once, at script-execution time, and
 *  renders the survey list into the target div right then. It exposes no
 *  public re-init API (confirmed: no window.CpxResearch global exists in
 *  the bundle). Because this is a Next.js SPA the injected script tag
 *  survives client-side navigation, so re-using it leaves the div empty on
 *  every visit after the first. Always inject a fresh tag to guarantee the
 *  survey wall re-renders on each mount.
 *
 * useIFrame: true — CPX's documented option to open each survey in an
 *  in-page iframe overlay rather than a new tab. Better UX on mobile and
 *  keeps the user inside the app while completing a survey.
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
    ;(window as any).config = {
      general_config: {
        app_id:      Number(appId), // CPX requires a number, not a string
        ext_user_id: userId,
        secure_hash: secureHash,    // MD5(userId + '-' + secureHashKey)
        username,
        email,
        subid_1:     "bountytask",
      },
      style_config: {},
      script_config: [
        {
          div_id:        DIV_ID,
          theme_style:   1,   // Design 1 — Full Content Widget
          order_by:      2,   // 1 = best score, 2 = best money, 3 = best conversion rate
          limit_surveys: 12,
        },
      ],
      useIFrame:     true,  // open each survey in an in-page iframe overlay (CPX documented option)
      iFramePosition: 1,    // 1 = right (default), 2 = left
    }

    // Step 2: strip previous script + clear div, then inject fresh
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
