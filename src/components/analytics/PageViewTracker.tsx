"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

const SESSION_KEY = "bt_session_id"
const HEARTBEAT_INTERVAL_MS = 15_000

function getSessionId() {
  if (typeof window === "undefined") return ""
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/**
 * Silent, invisible tracker mounted once in the root layout. Records a page
 * view on every route change and periodically reports time-on-page so the
 * admin analytics dashboard can show visitors, DAU, and time spent.
 * Admin routes are excluded so an admin's own usage doesn't skew traffic.
 */
export function PageViewTracker() {
  const pathname = usePathname()
  const viewIdRef = useRef<string | null>(null)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return

    let cancelled = false
    startRef.current = Date.now()
    viewIdRef.current = null

    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        sessionId: getSessionId(),
        referrer: document.referrer || undefined,
      }),
    })
      .then(r => r.json())
      .then(j => { if (!cancelled) viewIdRef.current = j.id ?? null })
      .catch(() => {})

    function sendHeartbeat(final: boolean) {
      const viewId = viewIdRef.current
      if (!viewId) return
      const duration = Math.round((Date.now() - startRef.current) / 1000)
      const payload = JSON.stringify({ viewId, duration })

      if (final && navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/heartbeat", new Blob([payload], { type: "application/json" }))
      } else {
        fetch("/api/analytics/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    }

    const interval = setInterval(() => sendHeartbeat(false), HEARTBEAT_INTERVAL_MS)

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") sendHeartbeat(true)
    }
    function handlePageHide() {
      sendHeartbeat(true)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      cancelled = true
      clearInterval(interval)
      sendHeartbeat(true)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
