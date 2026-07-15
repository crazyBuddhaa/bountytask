"use client"
/**
 * CPX Research Script Tag Widget
 *
 * State machine:
 *   loading    → script injected, waiting for CPX to initialise
 *   ready      → count_new_surveys fired with count > 0, or onload timeout
 *                elapsed without a no_surveys_available callback
 *   no-surveys → CPX fired no_surveys_available (no inventory for this user/geo)
 *   error      → <script> onerror (CDN unreachable or blocked)
 *
 * Why fresh injection on every mount:
 *   CPX's library reads window.config once at script-execution time and renders
 *   into the target div immediately. It exposes no public re-init API. Because
 *   this is a Next.js SPA the injected script tag survives client-side
 *   navigation, so reusing it leaves the div empty on every visit after the
 *   first. Always strip the old tag + clear the div, then inject fresh.
 *
 * Secure hash:
 *   Computed server-side as MD5(userId + '-' + secureHashKey) so the raw key
 *   is never sent to the browser.
 */

import { useEffect, useRef, useState } from "react"
import { ClipboardList, WifiOff, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface CpxWidgetProps {
  appId: string
  userId: string
  /** MD5(userId + '-' + secureHashKey) — computed server-side */
  secureHash: string
  username: string
  email: string
}

type WidgetStatus = "loading" | "ready" | "no-surveys" | "error"

const DIV_ID     = "cpx-survey-wall"
const SCRIPT_SRC = "https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js"
/** After script loads, wait this long for CPX callbacks before assuming surveys are rendering. */
const READY_TIMEOUT_MS = 5000

export function CpxWidget({ appId, userId, secureHash, username, email }: CpxWidgetProps) {
  const containerRef             = useRef<HTMLDivElement>(null)
  const [status, setStatus]      = useState<WidgetStatus>("loading")
  const [retryKey, setRetryKey]  = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus("loading")

    // ── window.config must be written BEFORE the script loads ─────────────────
    ;(window as any).config = {
      general_config: {
        app_id:      Number(appId),  // CPX requires a number, not a string
        ext_user_id: userId,
        secure_hash: secureHash,     // MD5(userId + '-' + secureHashKey), server-side
        username,
        email,
        subid_1:     "bountytask",
      },
      style_config: {},
      script_config: [
        {
          div_id:        DIV_ID,
          theme_style:   1,   // Design 1 — Full Content Widget (inline list)
          order_by:      2,   // 2 = best money (1 = best score, 3 = best conversion)
          limit_surveys: 12,
        },
      ],
      functions: {
        /** Fired by CPX when there are no surveys for this user/geo/device. */
        no_surveys_available: () => {
          if (!cancelled) setStatus("no-surveys")
        },
        /** Fired by CPX with the count of available surveys. */
        count_new_surveys: (count: number) => {
          if (!cancelled && count > 0) setStatus("ready")
        },
        /** Fired by CPX after a transaction completes (survey finished). */
        get_transaction: (_transactions: unknown) => {
          // no-op — crediting happens via server-side postback, not here
        },
      },
    }

    // ── Strip any previous CPX script + clear the div ─────────────────────────
    document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`).forEach((el) => el.remove())
    if (containerRef.current) containerRef.current.innerHTML = ""

    // ── Inject a fresh script tag ─────────────────────────────────────────────
    const script = document.createElement("script")
    script.type  = "text/javascript"
    script.src   = SCRIPT_SRC

    script.onerror = () => {
      if (!cancelled) setStatus("error")
    }

    script.onload = () => {
      // CPX initialises asynchronously after the script executes.
      // Give it READY_TIMEOUT_MS to fire a callback before we assume surveys
      // are rendering (i.e. CPX rendered into the div without calling either
      // count_new_surveys or no_surveys_available — treated as "ready").
      setTimeout(() => {
        if (!cancelled) {
          setStatus((prev) => (prev === "loading" ? "ready" : prev))
        }
      }, READY_TIMEOUT_MS)
    }

    document.body.appendChild(script)

    return () => {
      cancelled = true
      script.remove()
    }
  }, [appId, userId, secureHash, username, email, retryKey])

  // ── Status overlays ───────────────────────────────────────────────────────
  const overlay = (() => {
    switch (status) {
      case "loading":
        return (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/60" />
            ))}
          </div>
        )
      case "no-surveys":
        return (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="font-medium">No surveys right now</p>
              <p className="text-sm text-muted-foreground">
                CPX Research has no surveys matching your profile at this moment.
                This is normal — availability varies by country and time of day.
                Check back later.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRetryKey((k) => k + 1)}
                className="gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </Button>
            </CardContent>
          </Card>
        )
      case "error":
        return (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <WifiOff className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="font-medium">Couldn&apos;t load surveys</p>
              <p className="text-sm text-muted-foreground">
                The CPX Research widget failed to load. This is usually a temporary
                network issue. Check your connection and try again.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRetryKey((k) => k + 1)}
                className="gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </Button>
            </CardContent>
          </Card>
        )
      default:
        return null
    }
  })()

  return (
    <div className="w-full space-y-4">
      {overlay}
      {/* Always keep the div in the DOM so CPX can render into it.
          Hide it visually while loading/errored to avoid a blank flash. */}
      <div
        ref={containerRef}
        id={DIV_ID}
        className="w-full"
        style={{
          minHeight: status === "ready" ? 400 : 0,
          display:   status === "ready" ? "block" : "none",
        }}
      />
    </div>
  )
}
