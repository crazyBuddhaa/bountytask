"use client"
/**
 * Lootably offer wall widget client component.
 * Lootably provides a JS SDK that injects the offer wall into a container.
 */
import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Lootably?: { init: (opts: Record<string, string>) => void }
  }
}

interface Props {
  apiKey: string
  userId: string
}

export default function LootablyWidget({ apiKey, userId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptStatus, setScriptStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    if (scriptStatus !== "ready" || !containerRef.current) return
    if (typeof window.Lootably === "undefined") return

    window.Lootably.init({
      api_key: apiKey,
      user_id: userId,
      container: containerRef.current.id,
    })
  }, [scriptStatus, apiKey, userId])

  return (
    <div className="space-y-4">
      <Script
        src="https://cdn.lootably.com/widget.js"
        onReady={() => setScriptStatus("ready")}
        onError={() => setScriptStatus("error")}
        strategy="afterInteractive"
      />

      {scriptStatus === "loading" && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            <p className="text-sm text-muted-foreground">Loading offers…</p>
          </CardContent>
        </Card>
      )}

      {scriptStatus === "error" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">
            Could not load the offer wall. Check your connection or disable any ad blockers, then reload.
          </CardContent>
        </Card>
      )}

      <div
        id="lootably-widget-container"
        ref={containerRef}
        className="w-full min-h-[600px] rounded-xl overflow-hidden border border-border"
        style={{ display: scriptStatus === "ready" ? "block" : "none" }}
      />
    </div>
  )
}
