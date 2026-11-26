"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ShieldAlert, RefreshCw, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"

declare global {
  interface Window {
    __btAdBlockDetected?: boolean
    __btAdBaitLoaded?: boolean
  }
}

interface ReportResult {
  enabled: boolean
  action: "warning" | "penalty" | "disabled"
  strikesToday: number
  warningThreshold: number
  penaltyKobo: number
  debitedKobo: number
  cooldownActive: boolean
}

/**
 * Dual-signal client-side ad-blocker detector:
 *   1. DOM bait element with common EasyList ad classes
 *   2. Network fetch of local `/ads.js` bait file (blocked by EasyList / Brave / uBlock)
 */
async function detectAdBlocker(): Promise<{ blocked: boolean; method: "dom" | "network" | "both" | null }> {
  let domBlocked = false
  let netBlocked = false

  // Signal 1: DOM cosmetic filter bait
  try {
    const bait = document.createElement("div")
    bait.className = "adsbox ad-banner pub_300x250 pub_300x250m text-ad ad-unit"
    bait.setAttribute("aria-hidden", "true")
    bait.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:300px;height:250px;pointer-events:none;opacity:0.01;"
    bait.innerHTML = "&nbsp;"
    document.body.appendChild(bait)

    await new Promise((r) => setTimeout(r, 120))
    const style = window.getComputedStyle(bait)
    if (
      bait.offsetHeight === 0 ||
      bait.offsetWidth === 0 ||
      style.display === "none" ||
      style.visibility === "hidden"
    ) {
      domBlocked = true
    }
    bait.remove()
  } catch {
    // ignore DOM check errors
  }

  // Signal 2: Local `/ads.js` network bait
  try {
    const res = await fetch(`/ads.js?_=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
    })
    if (!res.ok) {
      netBlocked = true
    }
  } catch {
    netBlocked = true
  }

  if (domBlocked && netBlocked) return { blocked: true, method: "both" }
  if (domBlocked) return { blocked: true, method: "dom" }
  if (netBlocked) return { blocked: true, method: "network" }
  return { blocked: false, method: null }
}

export function AdBlockGuard() {
  const pathname = usePathname()
  const router = useRouter()

  const [blocked, setBlocked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [report, setReport] = useState<ReportResult | null>(null)
  const reportedRef = useRef(false)

  const runCheck = useCallback(
    async (isManualRecheck = false) => {
      if (isManualRecheck) setChecking(true)
      try {
        // First check if detector is enabled on the platform
        const cfgRes = await fetch("/api/anti-adblock/report", { cache: "no-store" })
        if (!cfgRes.ok) return
        const cfgJson = await cfgRes.json()
        if (!cfgJson?.data?.enabled) {
          window.__btAdBlockDetected = false
          setBlocked(false)
          return
        }

        const { blocked: isBlocked, method } = await detectAdBlocker()
        window.__btAdBlockDetected = isBlocked
        setBlocked(isBlocked)

        if (!isBlocked) {
          if (isManualRecheck) {
            toast.success("Ad blocker disabled! Thank you for supporting BountyTask.")
            router.refresh()
          }
          return
        }

        if (isManualRecheck) {
          toast.error("Ad blocker is still active. Please disable it for this site and try again.")
        }

        // Report strike to server (server enforces 30-min cooldown)
        if (!reportedRef.current || isManualRecheck) {
          reportedRef.current = true
          const repRes = await fetch("/api/anti-adblock/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              page_path: pathname,
              method: method ?? "network",
            }),
          })
          if (repRes.ok) {
            const repJson = await repRes.json()
            const data = repJson?.data as ReportResult | undefined
            if (data) {
              setReport(data)
              if (data.action === "penalty" && data.debitedKobo > 0 && !data.cooldownActive) {
                toast.error(
                  `Ad-blocker penalty: ${formatCurrency(data.debitedKobo)} deducted from your wallet.`
                )
                router.refresh()
              }
            }
          }
        }
      } catch {
        // Never crash dashboard on detector failure
      } finally {
        if (isManualRecheck) setChecking(false)
      }
    },
    [pathname, router]
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      runCheck(false)
    }, 900)
    return () => clearTimeout(timer)
  }, [runCheck])

  if (!blocked) return null

  const strikes = report?.strikesToday ?? 1
  const threshold = report?.warningThreshold ?? 2
  const penaltyKobo = report?.penaltyKobo ?? 5000
  const warningsLeft = Math.max(0, threshold - strikes)
  const isPenalty = report?.action === "penalty"

  return (
    <>
      {/* Persistent top warning bar */}
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="font-medium text-destructive">
            Ad blocker detected — earning is paused until you disable it for this site.
          </span>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => runCheck(true)}
          disabled={checking}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
          Re-check
        </Button>
      </div>

      {/* Blocking modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adblock-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 id="adblock-modal-title" className="text-lg font-bold text-foreground">
                Please disable your ad blocker
              </h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Ads fund free Naira payouts on BountyTask. You cannot earn rewards while an ad
                blocker or Brave Shields is active on this site.
              </p>
            </div>
          </div>

          {/* Strike & Penalty Status */}
          <div
            className={`rounded-xl border p-3.5 text-xs space-y-1.5 ${
              isPenalty
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
            }`}
          >
            <p className="font-semibold tabular-nums">
              {isPenalty
                ? `Penalty Applied — Strike #${strikes} today`
                : `Warning #${strikes} of ${threshold} today`}
            </p>
            {isPenalty ? (
              <p className="leading-relaxed">
                {report && report.debitedKobo > 0
                  ? `${formatCurrency(report.debitedKobo)} has been deducted from your wallet and your account has been flagged.`
                  : penaltyKobo > 0
                    ? `Continued ad-blocker usage incurs a ${formatCurrency(penaltyKobo)} wallet penalty per offense and flags your account.`
                    : "Continued ad-blocker usage flags your account for review."}
              </p>
            ) : (
              <p className="leading-relaxed">
                {penaltyKobo > 0
                  ? warningsLeft > 0
                    ? `You have ${warningsLeft} warning${warningsLeft === 1 ? "" : "s"} left today before a ${formatCurrency(penaltyKobo)} wallet penalty is applied.`
                    : `Next detection will incur a ${formatCurrency(penaltyKobo)} wallet penalty and flag your account.`
                  : "Repeated usage will flag your account for review."}
              </p>
            )}
          </div>

          {/* Quick instructions */}
          <div className="rounded-xl bg-muted/50 p-3.5 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">How to disable:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong className="text-foreground">Brave:</strong> Tap the lion icon in the address
                bar and turn <em>Shields</em> OFF for this site.
              </li>
              <li>
                <strong className="text-foreground">uBlock / AdBlock:</strong> Click the extension
                icon and pause/whitelist this domain.
              </li>
              <li>
                <strong className="text-foreground">Opera / Private DNS:</strong> Turn off built-in
                ad blocking for this site, then tap Re-check.
              </li>
            </ul>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => runCheck(true)}
            disabled={checking}
          >
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking..." : "I've disabled it — Re-check"}
          </Button>
        </div>
      </div>
    </>
  )
}
