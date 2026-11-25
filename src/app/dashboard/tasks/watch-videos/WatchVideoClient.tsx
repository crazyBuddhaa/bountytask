"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { CheckCircle2, Loader2, PlayCircle, Lock } from "lucide-react"
import type { Task } from "@/types"

// Extend window for YouTube IFrame API (loaded via script tag at runtime)
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

interface Props {
  task: Task
  onClaimed: () => void
}

function extractVideoId(url: string): string {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/
  )
  return match?.[1] ?? ""
}

export default function WatchVideoClient({ task, onClaimed }: Props) {
  const playerRef        = useRef<any>(null)
  const heartbeatRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const localCountRef    = useRef(0)
  const [heartbeatCount, setHeartbeatCount] = useState(0)
  const [playerReady, setPlayerReady]   = useState(false)
  const [canClaim, setCanClaim]         = useState(false)
  const [claiming, setClaiming]         = useState(false)
  const [progress, setProgress]         = useState(0) // 0-100
  const required = task.min_watch_seconds ?? 30
  const videoId  = extractVideoId(task.youtube_url!)

  // Register watch session as soon as the component mounts
  useEffect(() => {
    let active = true
    fetch(`/api/tasks/${task.id}/watch/start`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok && active) {
          const json = await res.json().catch(() => ({}))
          toast.error(json.error ?? "Could not start watch session. Please refresh.")
        }
      })
      .catch(() => {
        if (active) toast.error("Network error starting watch session.")
      })
    return () => { active = false }
  }, [task.id])

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return
    heartbeatRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}/watch/heartbeat`, { method: "POST" })
        if (res.ok) {
          const json = await res.json().catch(() => ({}))
          const serverCount =
            typeof json?.heartbeat_count === "number"
              ? json.heartbeat_count
              : typeof json?.data?.heartbeat_count === "number"
              ? json.data.heartbeat_count
              : localCountRef.current + 1
          localCountRef.current = serverCount
          setHeartbeatCount(serverCount)
          const watchedSeconds = serverCount * 10
          const pct = Math.min(Math.round((watchedSeconds / required) * 100), 100)
          setProgress(pct)
          if (watchedSeconds >= required) setCanClaim(true)
        }
      } catch { /* silent */ }
    }, 10_000)
  }, [task.id, required])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat()
      try { playerRef.current?.destroy?.() } catch { /* ignore */ }
      playerRef.current = null
    }
  }, [stopHeartbeat])

  const initPlayer = useCallback(() => {
    if (!videoId) return
    try { playerRef.current?.destroy?.() } catch { /* ignore */ }
    playerRef.current = new window.YT.Player("yt-player", {
      videoId,
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onReady: () => setPlayerReady(true),
        onStateChange: (event: { data: number }) => {
          const S = window.YT.PlayerState
          if (event.data === S.PLAYING) {
            startHeartbeat()
          } else if (event.data === S.ENDED) {
            stopHeartbeat()
            const watchedSeconds = localCountRef.current * 10
            if (watchedSeconds >= required) {
              setCanClaim(true)
              setProgress(100)
            }
          } else {
            stopHeartbeat()
          }
        },
      },
    })
  }, [videoId, required, startHeartbeat, stopHeartbeat])

  // Load YouTube IFrame API once
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.YT?.Player) { initPlayer(); return }
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (!existingScript) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      document.head.appendChild(tag)
    }
    const prevReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === "function" && prevReady !== initPlayer) prevReady()
      initPlayer()
    }
  }, [initPlayer])

  async function handleClaim() {
    setClaiming(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not claim reward. Please try again.")
        return
      }
      toast.success(`₦${(task.reward_amount / 100).toFixed(2)} credited to your balance!`)
      onClaimed()
    } catch {
      toast.error("Network error while claiming reward. Please try again.")
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Player */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video w-full shadow-lg">
        {!playerReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        <div id="yt-player" className="w-full h-full" />
      </div>

      {/* Watch progress bar */}
      <Card className="bg-muted/40">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <PlayCircle className="w-3.5 h-3.5" />
              Watch progress
            </span>
            <span className="font-medium tabular-nums text-xs">
              {Math.min(heartbeatCount * 10, required)}s / {required}s
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {canClaim && (
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Watch requirement met — you can claim your reward.
            </p>
          )}
          {!canClaim && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Keep watching — reward unlocks after {Math.ceil(required / 60)} min{required >= 120 ? "s" : ""} of playback.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Claim button */}
      <Button
        size="lg"
        className="w-full"
        disabled={!canClaim || claiming}
        onClick={handleClaim}
      >
        {claiming ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Crediting…</>
        ) : canClaim ? (
          <><CheckCircle2 className="w-4 h-4" /> Claim ₦{(task.reward_amount / 100).toFixed(2)}</>
        ) : (
          <><Lock className="w-4 h-4" /> Watch to unlock reward</>
        )}
      </Button>

      {/* Task meta */}
      <div className="text-xs text-muted-foreground space-y-1 pt-1">
        <p>• Pausing the video pauses your watch timer — only active playback counts.</p>
        <p>• Each video can only be claimed once per account.</p>
        <p>• Reward is credited instantly after claiming.</p>
      </div>
    </div>
  )
}
