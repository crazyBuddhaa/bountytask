"use client"
/**
 * CPX Research IFrame Widget
 *
 * Renders the CPX Research survey wall in an isolated iframe.
 * The secure hash is computed server-side and passed as a prop so the
 * secureHashKey is never exposed to the browser.
 *
 * Advantages over the script-tag approach:
 *  - CPX's JS is fully sandboxed — cannot access this page's DOM or globals.
 *  - No re-init problem: each mount generates a fresh src URL, so the iframe
 *    always loads a clean survey list regardless of SPA navigation history.
 *  - No script-injection lifecycle to manage.
 */

interface CpxWidgetProps {
  appId: string
  userId: string
  /** MD5(userId + '-' + secureHashKey) — computed server-side */
  secureHash: string
}

const BASE_URL = "https://offers.cpx-research.com/index.php"

export function CpxWidget({ appId, userId, secureHash }: CpxWidgetProps) {
  const params = new URLSearchParams({
    app_id:       appId,
    ext_user_id:  userId,
    secure_hash:  secureHash,
    subid_1:      "bountytask",
  })

  return (
    <iframe
      src={`${BASE_URL}?${params.toString()}`}
      className="w-full rounded-lg border border-border/60"
      style={{ height: 600, minHeight: 400 }}
      scrolling="yes"
      frameBorder="0"
      title="CPX Research Surveys"
    />
  )
}
