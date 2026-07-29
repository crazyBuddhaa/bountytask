"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import {
  ArrowLeft, Clock, ExternalLink, Newspaper,
  Timer, Coins, CheckCircle2, Loader2, AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

type Article = {
  id:            string
  title:         string
  snippet:       string | null
  thumbnail_url: string | null
  source_name:   string
  article_url:   string
  category:      string
  published_at:  string | null
  content:       string | null
}

type EarnInfo = {
  earnEnabled:          boolean
  koboPerMinute:        number
  maxMinutesPerArticle: number
  dailyCapMinutes:      number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, string> = {
  politics:      "bg-red-50    text-red-700    border-red-200    dark:bg-red-950/40    dark:text-red-300    dark:border-red-800",
  business:      "bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-950/40   dark:text-blue-300   dark:border-blue-800",
  tech:          "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  sports:        "bg-green-50  text-green-700  border-green-200  dark:bg-green-950/40  dark:text-green-300  dark:border-green-800",
  entertainment: "bg-pink-50   text-pink-700   border-pink-200   dark:bg-pink-950/40   dark:text-pink-300   dark:border-pink-800",
  general:       "bg-gray-50   text-gray-700   border-gray-200   dark:bg-gray-950/40   dark:text-gray-300   dark:border-gray-800",
}

/** Heartbeat interval in ms (60 seconds = 1 minute credited per tick). */
const HEARTBEAT_MS = 60_000
/** How often to update the on-screen timer (1 second). */
const TICK_MS = 1_000

function fmt(kobo: number) {
  return `₦${(kobo / 100).toFixed(2)}`
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArticleReaderPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  // Article data
  const [article, setArticle]   = useState<Article | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Earn state
  const [earnInfo, setEarnInfo]           = useState<EarnInfo | null>(null)
  const [minutesCredited, setMinutesCredited] = useState(0)
  const [dailyMinutesUsed, setDailyMinutesUsed] = useState(0)
  const [capReached, setCapReached]           = useState(false)
  const [totalEarnedKobo, setTotalEarnedKobo] = useState(0)

  // Timer display
  const [secondsOnPage, setSecondsOnPage] = useState(0)

  // Refs for intervals
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const capRef       = useRef(false)

  // ── Fetch article + content + mark as read ─────────────────────────────────
  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      try {
        const [contentRes, readRes] = await Promise.all([
          fetch(`/api/news/${id}/content`),
          fetch(`/api/news/${id}/read`, { method: "POST" }),
        ])

        if (contentRes.status === 404) {
          if (!cancelled) setNotFound(true)
          return
        }

        const contentJson = await contentRes.json()
        const readJson    = readRes.ok ? await readRes.json() : null

        if (!cancelled) {
          setArticle(contentJson.article ?? null)
          if (readJson) {
            setEarnInfo({
              earnEnabled:          readJson.earnEnabled          ?? false,
              koboPerMinute:        readJson.koboPerMinute        ?? 200,
              maxMinutesPerArticle: readJson.maxMinutesPerArticle ?? 5,
              dailyCapMinutes:      readJson.dailyCapMinutes      ?? 30,
            })
            setMinutesCredited(readJson.minutesCredited ?? 0)
          }
          setLoading(false)
        }
      } catch {
        if (!cancelled) { setLoading(false); setNotFound(true) }
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  const sendHeartbeat = useCallback(async () => {
    if (capRef.current) return
    try {
      const res  = await fetch(`/api/news/${id}/heartbeat`, { method: "POST" })
      const json = await res.json()

      if (json.credited) {
        setMinutesCredited(json.minutes_credited)
        setDailyMinutesUsed(json.daily_minutes_used)
        setTotalEarnedKobo(prev => prev + json.kobo)
        toast.success(`+${fmt(json.kobo)} earned!`, {
          description: `${json.minutes_credited} min read · ${fmt(json.kobo)} per minute`,
          duration:    2500,
        })
      }

      if (
        json.reason === "article_cap_reached" ||
        json.reason === "daily_cap_reached"
      ) {
        capRef.current = true
        setCapReached(true)
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current)
          heartbeatRef.current = null
        }
      }

      if (json.daily_minutes_used !== undefined) {
        setDailyMinutesUsed(json.daily_minutes_used)
      }
    } catch { /* silent — will retry next tick */ }
  }, [id])

  // ── Start timers once article is loaded and earn is enabled ───────────────
  useEffect(() => {
    if (loading || !earnInfo?.earnEnabled) return

    // On-screen tick counter
    tickRef.current = setInterval(() => {
      setSecondsOnPage(s => s + 1)
    }, TICK_MS)

    // Heartbeat every 60 seconds
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_MS)

    return () => {
      if (tickRef.current)      clearInterval(tickRef.current)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [loading, earnInfo, sendHeartbeat])

  // ── Derived values ─────────────────────────────────────────────────────────
  const maxMin       = earnInfo?.maxMinutesPerArticle ?? 5
  const dailyCap     = earnInfo?.dailyCapMinutes      ?? 30
  const articlePct   = maxMin > 0 ? Math.min(100, (minutesCredited / maxMin) * 100) : 0
  const dailyPct     = dailyCap > 0 ? Math.min(100, (dailyMinutesUsed / dailyCap) * 100) : 0
  const nextMinSecs  = HEARTBEAT_MS / 1000 - (secondsOnPage % (HEARTBEAT_MS / 1000))
  const koboPerMin   = earnInfo?.koboPerMinute ?? 200

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className={`h-4 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />
          ))}
        </div>
      </div>
    )
  }

  if (notFound || !article) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-12 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="font-semibold text-lg">Article not found</p>
        <p className="text-sm text-muted-foreground">
          This article may have been removed or is no longer available.
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboard/news")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to News
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">

      {/* ── Back nav ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/news")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to News
        </Button>
      </div>

      {/* ── Earn widget ──────────────────────────────────────────────────── */}
      {earnInfo?.earnEnabled && (
        <div className={`rounded-2xl border p-4 space-y-3 ${
          capReached
            ? "border-muted bg-muted/30"
            : "border-primary/30 bg-primary/5"
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Coins className={`w-4 h-4 ${capReached ? "text-muted-foreground" : "text-amber-500"}`} />
              <span className="text-sm font-semibold">
                {capReached ? "Earning complete for this article" : `Earn ${fmt(koboPerMin)} per minute you read`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {totalEarnedKobo > 0 && (
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  +{fmt(totalEarnedKobo)} earned
                </span>
              )}
              {!capReached && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="w-3 h-3" />
                  <span>Next credit in {nextMinSecs}s</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>This article</span>
                <span>{minutesCredited}/{maxMin} min</span>
              </div>
              <Progress value={articlePct} className="h-1.5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Today</span>
                <span>{dailyMinutesUsed}/{dailyCap} min</span>
              </div>
              <Progress value={dailyPct} className="h-1.5" />
            </div>
          </div>

          {capReached && (
            <p className="text-xs text-muted-foreground text-center">
              You&apos;ve earned the maximum for this article. Open another article to keep earning.
            </p>
          )}
        </div>
      )}

      {/* ── Article card ─────────────────────────────────────────────────── */}
      <article className="rounded-2xl border bg-card overflow-hidden shadow-sm">

        {/* Header */}
        <div className="p-6 space-y-4 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${
              CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES.general
            }`}>
              {article.category}
            </span>
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Newspaper className="w-3 h-3" />
              {article.source_name}
            </span>
            {article.published_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold leading-snug">{article.title}</h1>

          {article.snippet && (
            <p className="text-muted-foreground text-sm leading-relaxed border-l-2 border-primary/30 pl-3 italic">
              {article.snippet}
            </p>
          )}
        </div>

        {/* Thumbnail */}
        {article.thumbnail_url && (
          <div className="bg-muted overflow-hidden max-h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.thumbnail_url}
              alt={article.title}
              className="w-full object-cover max-h-80"
              onError={e => { (e.currentTarget as HTMLImageElement).parentElement?.classList.add("hidden") }}
            />
          </div>
        )}

        {/* Body */}
        <div className="p-6">
          {article.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {article.content.split("\n\n").filter(Boolean).map((para, i) => (
                <p key={i} className="text-sm leading-relaxed text-foreground mb-4 last:mb-0">
                  {para.trim()}
                </p>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Full content isn&apos;t available for this article.
              </p>
              <a
                href={article.article_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Read on {article.source_name} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer / Source attribution */}
        <footer className="border-t bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                Original Source
              </p>
              <p className="text-sm font-medium">{article.source_name}</p>
              {article.published_at && (
                <p className="text-xs text-muted-foreground">
                  Published {new Date(article.published_at).toLocaleDateString("en-NG", {
                    day:   "numeric",
                    month: "long",
                    year:  "numeric",
                  })}
                </p>
              )}
            </div>
            <a
              href={article.article_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
            >
              Read full article on {article.source_name}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            This article is sourced from {article.source_name} via RSS. BountyTask does not claim ownership of this content.
          </p>
        </footer>
      </article>

      {/* ── Earn summary at the bottom ────────────────────────────────────── */}
      {earnInfo?.earnEnabled && minutesCredited > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            You earned <strong>{fmt(minutesCredited * koboPerMin)}</strong> for reading this article
            ({minutesCredited} min × {fmt(koboPerMin)}/min).
          </p>
        </div>
      )}

      {/* ── Back nav (bottom) ─────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => router.push("/dashboard/news")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to News Feed
        </Button>
      </div>
    </div>
  )
}
