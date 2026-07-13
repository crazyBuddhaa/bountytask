"use client"
/**
 * HideoutTV widget client component.
 * Loads HideoutTV's JavaScript SDK and initialises the video player.
 * The SDK injects an iframe into the container div once loaded.
 */
import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

// HideoutTV global type
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HideoutTV?: { init: (opts: Record<string, string>) => void }
  }
}

interface Props {
  publisherId: string
  userId: string
}

export default function HideoutWidget({ publisherId, userId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptStatus, setScriptStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    if (scriptStatus !== "ready" || !containerRef.current) return
    if (typeof window.HideoutTV === "undefined") return

    window.HideoutTV.init({
      publisher_id: publisherId,
      user_id: userId,
      container: containerRef.current.id,
    })
  }, [scriptStatus, publisherId, userId])

  return (
    <div className="space-y-4">
      <Script
        src="https://cdn.hideout.tv/widget.js"
        onReady={() => setScriptStatus("ready")}
        onError={() => setScriptStatus("error")}
        strategy="afterInteractive"
      />

      {scriptStatus === "loading" && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            <p className="text-sm text-muted-foreground">Loading video player…</p>
          </CardContent>
        </Card>
      )}

      {scriptStatus === "error" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">
            Could not load the video player. Check your connection or disable any ad blockers, then reload the page.
          </CardContent>
        </Card>
      )}

      <div
        id="hideout-widget-container"
        ref={containerRef}
        className="w-full min-h-[500px] rounded-xl overflow-hidden border border-border"
        style={{ display: scriptStatus === "ready" ? "block" : "none" }}
      />
    </div>
  )
}
