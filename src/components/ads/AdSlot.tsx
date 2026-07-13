"use client"
import { useEffect, useRef, useState } from "react"

type Placement = "dashboard" | "tasklist" | "earnings"

/**
 * Renders an admin-configured ad snippet for a given placement.
 * The `earnings` placement reuses the dashboard snippet (same ad unit).
 * Returns null if ads are disabled or the snippet is empty.
 *
 * Script execution: dangerouslySetInnerHTML does not execute <script> tags
 * added via innerHTML. After mounting, this component re-creates each script
 * element so external SDKs (AdSense, etc.) actually initialise.
 */
export function AdSlot({ placement }: { placement: Placement }) {
  const [snippet, setSnippet] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading")
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings/ads")
      .then((r) => r.json())
      .then(({ data }) => {
        if (cancelled) return
        if (!data?.enabled) { setStatus("empty"); return }
        const html =
          placement === "dashboard" ? data.dashboard_snippet :
          placement === "tasklist"  ? data.tasklist_snippet :
          /* earnings */              (data.dashboard_snippet ?? "")
        if (html?.trim()) {
          setSnippet(html)
          setStatus("ready")
        } else {
          setStatus("empty")
        }
      })
      .catch(() => { if (!cancelled) setStatus("error") })
    return () => { cancelled = true }
  }, [placement])

  // Re-run <script> tags that dangerouslySetInnerHTML won't execute.
  useEffect(() => {
    if (status !== "ready" || !snippet || !containerRef.current) return
    const el = containerRef.current
    el.querySelectorAll("script").forEach((old) => {
      const fresh = document.createElement("script")
      Array.from(old.attributes).forEach((a) => fresh.setAttribute(a.name, a.value))
      if (!old.src) fresh.textContent = old.textContent
      old.parentNode?.replaceChild(fresh, old)
    })
  }, [status, snippet])

  // Show a thin skeleton while fetching settings (avoids layout shift).
  if (status === "loading") {
    return <div className="h-16 rounded-lg bg-muted/40 animate-pulse" aria-hidden />
  }
  if (status !== "ready" || !snippet) return null

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-border/60 bg-muted/40 p-2 overflow-hidden"
      aria-label="Advertisement"
      dangerouslySetInnerHTML={{ __html: snippet }}
    />
  )
}
