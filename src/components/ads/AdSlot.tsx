"use client"
import { useEffect, useState } from "react"

type Placement = "dashboard" | "tasklist"

/**
 * Renders an admin-configured ad snippet for a given placement, or nothing
 * if display ads are disabled / no snippet is set for that placement. The
 * snippet is admin-authored HTML (same trust boundary as other platform
 * settings), so it's safe to inject directly.
 */
export function AdSlot({ placement }: { placement: Placement }) {
  const [snippet, setSnippet] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/settings/ads")
      .then((r) => r.json())
      .then(({ data }) => {
        if (!data?.enabled) return
        const html = placement === "dashboard" ? data.dashboard_snippet : data.tasklist_snippet
        if (html?.trim()) setSnippet(html)
      })
      .catch(() => {})
  }, [placement])

  if (!snippet) return null

  return (
    <div className="rounded-lg border border-border/60 bg-muted/40 p-2 overflow-hidden" aria-label="Advertisement">
      <div dangerouslySetInnerHTML={{ __html: snippet }} />
    </div>
  )
}
