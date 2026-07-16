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
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  return match?.[1] ?? ""
}

export default function WatchVideoClient({ task, onClaimed }: Props) {
  const playerRef        = useRef<any>(null)
  const heartbeatRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const localCountRef    = useRef(0)
  const [playerReady, setPlayerReady]   = useState(false)
  const [canClaim, setCanClaim]         = useState(false)
  const [claiming, setClaiming]         = useState(false)
  const [progress, setProgress]         = useState(0) // 0-100
  const required = task.min_watch_seconds ?? 30
  const videoId  = extractVideoId(task.youtube_url!)

  // Register watch session as soon as the component mounts
  useEffect(() => {
    fetch(`/api/tasks/${task.id}/watch/start`, { method: "POST" })
  }, [task.id])

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return
    heartbeatRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}/watch/heartbeat`, { method: "POST" })
        if (res.ok) {
          localCountRef.current += 1
          const watched = localCountRef.current * 10
          const pct = Math.min(Math.round((watched / required) * 100), 100)
          setProgress(pct)
          if (watched >= required) setCanClaim(true)
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
  useEffect(() => () => stopHeartbeat(), [stopHeartbeat])

  const initPlayer = useCallback(() => {
    if (!videoId) return
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
            setCanClaim(true)
            setProgress(100)
          } else {
            stopHeartbeat()
          }
        },
      },
    })
  }, [videoId, startHeartbeat, stopHeartbeat])

  // Load YouTube IFrame API once
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.YT?.Player) { initPlayer(); return }
    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = initPlayer
  }, [initPlayer])

  async function handleClaim() {
    setClaiming(true)
    const res = await fetch(`/api/tasks/${task.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error)
      setClaiming(false)
      return
    }
    toast.success(`₦${(task.reward_amount / 100).toFixed(2)} credited to your balance!`)
    onClaimed()
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
              {Math.min(localCountRef.current * 10, required)}s / {required}s
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
