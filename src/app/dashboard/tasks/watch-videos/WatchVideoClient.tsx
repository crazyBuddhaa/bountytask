"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import {
  CheckCircle2,
  Loader2,
  PlayCircle,
  Lock,
  ExternalLink,
  KeyRound,
  SkipForward,
  Clock,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { Task } from "@/types"

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
  onSkip?: () => void
}

function extractVideoId(url: string): string {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/
  )
  return match?.[1] ?? ""
}

export default function WatchVideoClient({ task, onClaimed, onSkip }: Props) {
  if (task.has_secret_code) {
    return <SecretCodeVideoTask task={task} onClaimed={onClaimed} onSkip={onSkip} />
  }
  return <EmbeddedVideoTask task={task} onClaimed={onClaimed} onSkip={onSkip} />
}

/**
 * Native YouTube Secret-Code Mode:
 * Users open the video directly in the YouTube app/site (genuine views & retention),
 * wait at least `min_watch_seconds`, and enter the secret code shown/spoken in the video.
 */
function SecretCodeVideoTask({ task, onClaimed, onSkip }: Props) {
  const required = task.min_watch_seconds ?? 30
  const videoId = extractVideoId(task.youtube_url ?? "")
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null

  const [opened, setOpened] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [code, setCode] = useState("")
  const [claiming, setClaiming] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start server watch session on mount
  useEffect(() => {
    let active = true
    fetch(`/api/tasks/${task.id}/watch/start`, { method: "POST" })
      .then(async (res) => {
        if (!active) return
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          toast.error(json.error ?? "Could not start watch session. Please refresh.")
          return
        }
        setSessionReady(true)
      })
      .catch(() => {
        if (active) toast.error("Network error starting watch session.")
      })
    return () => {
      active = false
    }
  }, [task.id])

  // Wall-clock elapsed timer (counts once session is started)
  useEffect(() => {
    if (!sessionReady) return
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => (prev < required ? prev + 1 : prev))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [sessionReady, required])

  const remainingSec = Math.max(0, required - elapsedSec)
  const timerMet = remainingSec === 0

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) {
      toast.error("Please enter the secret code from the video.")
      return
    }
    setClaiming(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_code: code.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not verify code. Please try again.")
        return
      }
      toast.success(`${formatCurrency(task.reward_amount)} credited to your balance!`)
      onClaimed()
    } catch {
      toast.error("Network error while claiming reward. Please try again.")
    } finally {
      setClaiming(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Video thumbnail preview */}
        {thumbnailUrl && (
          <a
            href={task.youtube_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpened(true)}
            className="block relative aspect-video w-full bg-black overflow-hidden group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt={task.title}
              className="w-full h-full object-cover opacity-90 group-hover:scale-[1.02] transition-transform"
            />
            <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center gap-2 text-white">
              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <PlayCircle className="w-8 h-8 text-white" />
              </div>
              <span className="text-xs font-semibold bg-black/70 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                Watch on YouTube
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </a>
        )}

        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-base leading-snug">{task.title}</h2>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
              )}
            </div>
            <Badge className="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-bold tabular-nums">
              +{formatCurrency(task.reward_amount)}
            </Badge>
          </div>

          {/* Step 1: Open on YouTube */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-foreground">
                1. Watch the video on YouTube and listen/look for the secret code
              </span>
              <span className="text-muted-foreground tabular-nums shrink-0 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {timerMet ? "Ready" : `${remainingSec}s`}
              </span>
            </div>
            {task.video_code_hint && (
              <p className="text-xs text-muted-foreground">
                Hint: <span className="text-foreground font-medium">{task.video_code_hint}</span>
              </p>
            )}
            <Button
              type="button"
              variant={opened ? "outline" : "default"}
              size="sm"
              className="w-full"
              asChild
            >
              <a
                href={task.youtube_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpened(true)}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {opened ? "Re-open Video on YouTube" : "Open Video on YouTube"}
              </a>
            </Button>
          </div>

          {/* Step 2: Enter secret code */}
          <form onSubmit={handleClaim} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="video-secret-code" className="text-xs font-semibold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-primary" />
                2. Enter the secret code from the video
              </Label>
              <Input
                id="video-secret-code"
                placeholder="Type the code shown or spoken in the video"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={claiming || !timerMet || !code.trim()}
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying…
                  </>
                ) : !timerMet ? (
                  <>
                    <Lock className="w-4 h-4" />
                    Wait {remainingSec}s to submit
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Verify &amp; Claim {formatCurrency(task.reward_amount)}
                  </>
                )}
              </Button>
              {onSkip && (
                <Button type="button" variant="outline" size="icon" onClick={onSkip} aria-label="Skip video">
                  <SkipForward className="w-4 h-4" />
                </Button>
              )}
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Classic Embedded IFrame Mode (for video tasks without a secret code):
 * Hardened with tab-visibility auto-pause, 1x speed lock, ad-block check,
 * and smooth 1-second progress synced to 10-second server heartbeats.
 */
function EmbeddedVideoTask({ task, onClaimed, onSkip }: Props) {
  const playerRef = useRef<any>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const localCountRef = useRef(0)

  const [watchedSecDisplay, setWatchedSecDisplay] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)
  const [canClaim, setCanClaim] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [pausedByTab, setPausedByTab] = useState(false)

  const required = task.min_watch_seconds ?? 30
  const videoId = extractVideoId(task.youtube_url ?? "")

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
    return () => {
      active = false
    }
  }, [task.id])

  const stopTimers = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const startTimers = useCallback(() => {
    if (!tickRef.current) {
      tickRef.current = setInterval(() => {
        if (document.hidden || window.__btAdBlockDetected) return
        // Enforce 1x playback rate
        try {
          if (playerRef.current?.getPlaybackRate?.() > 1) {
            playerRef.current.setPlaybackRate(1)
          }
        } catch { /* ignore */ }
        setWatchedSecDisplay((prev) => Math.min(prev + 1, required))
      }, 1000)
    }

    if (!heartbeatRef.current) {
      heartbeatRef.current = setInterval(async () => {
        if (document.hidden || window.__btAdBlockDetected) return
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
            const watchedSeconds = serverCount * 10
            setWatchedSecDisplay((prev) => Math.max(prev, Math.min(watchedSeconds, required)))
            if (watchedSeconds >= required) setCanClaim(true)
          }
        } catch { /* silent */ }
      }, 10_000)
    }
  }, [task.id, required])

  // Auto-pause video & heartbeats when user switches tabs
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        stopTimers()
        try {
          playerRef.current?.pauseVideo?.()
          setPausedByTab(true)
        } catch { /* ignore */ }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [stopTimers])

  useEffect(() => {
    return () => {
      stopTimers()
      try { playerRef.current?.destroy?.() } catch { /* ignore */ }
      playerRef.current = null
    }
  }, [stopTimers])

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
            setPausedByTab(false)
            startTimers()
          } else if (event.data === S.ENDED) {
            stopTimers()
            if (localCountRef.current * 10 >= required) {
              setCanClaim(true)
              setWatchedSecDisplay(required)
            }
          } else {
            stopTimers()
          }
        },
      },
    })
  }, [videoId, required, startTimers, stopTimers])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.YT?.Player) {
      initPlayer()
      return
    }
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
      toast.success(`${formatCurrency(task.reward_amount)} credited to your balance!`)
      onClaimed()
    } catch {
      toast.error("Network error while claiming reward. Please try again.")
    } finally {
      setClaiming(false)
    }
  }

  const progress = Math.min(Math.round((watchedSecDisplay / required) * 100), 100)

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative aspect-video w-full bg-black">
          <div id="yt-player" className="w-full h-full" />
          {!playerReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading player…
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-base leading-snug">{task.title}</h2>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
              )}
            </div>
            <Badge className="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-bold tabular-nums">
              +{formatCurrency(task.reward_amount)}
            </Badge>
          </div>

          {pausedByTab && !canClaim && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              Paused because you left the tab. Press Play to continue earning.
            </p>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
              <span className="flex items-center gap-1.5">
                <PlayCircle className="w-3.5 h-3.5 text-primary" />
                {canClaim
                  ? "Watch requirement met — ready to claim!"
                  : `Watch at least ${required}s on this tab to unlock reward`}
              </span>
              <span className="font-medium text-foreground">
                {watchedSecDisplay}s / {required}s
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  canClaim ? "bg-emerald-500" : "bg-primary"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="flex-1"
              disabled={!canClaim || claiming}
              onClick={handleClaim}
            >
              {claiming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming…
                </>
              ) : canClaim ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Claim {formatCurrency(task.reward_amount)}
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Keep watching to unlock
                </>
              )}
            </Button>
            {onSkip && (
              <Button type="button" variant="outline" size="icon" onClick={onSkip} aria-label="Skip video">
                <SkipForward className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
