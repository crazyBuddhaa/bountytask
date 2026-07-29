"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  ExternalLink, Newspaper, Clock, TrendingUp, RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import type { NewsSettings } from "@/lib/news"
import { formatDistanceToNow } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

type NewsArticle = {
  id:            string
  title:         string
  snippet:       string | null
  thumbnail_url: string | null
  source_name:   string
  article_url:   string
  category:      string
  published_at:  string | null
  read:          boolean
}

interface Props {
  initialArticles: NewsArticle[]
  initialHasMore:  boolean
  settings:        NewsSettings
  readsToday:      number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "all",           label: "All"           },
  { value: "politics",      label: "Politics"      },
  { value: "business",      label: "Business"      },
  { value: "tech",          label: "Tech"          },
  { value: "sports",        label: "Sports"        },
  { value: "entertainment", label: "Entertainment" },
  { value: "general",       label: "General"       },
]

const CATEGORY_STYLES: Record<string, string> = {
  politics:      "bg-red-50    text-red-700    border-red-200    dark:bg-red-950/40    dark:text-red-300    dark:border-red-800",
  business:      "bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-950/40   dark:text-blue-300   dark:border-blue-800",
  tech:          "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  sports:        "bg-green-50  text-green-700  border-green-200  dark:bg-green-950/40  dark:text-green-300  dark:border-green-800",
  entertainment: "bg-pink-50   text-pink-700   border-pink-200   dark:bg-pink-950/40   dark:text-pink-300   dark:border-pink-800",
  general:       "bg-gray-50   text-gray-700   border-gray-200   dark:bg-gray-950/40   dark:text-gray-300   dark:border-gray-800",
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewsClient({
  initialArticles,
  initialHasMore,
  settings,
  readsToday: initialReadsToday,
}: Props) {
  const [category,    setCategory]    = useState("all")
  const [articles,    setArticles]    = useState(initialArticles)
  const [loading,     setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page,        setPage]        = useState(1)
  const [hasMore,     setHasMore]     = useState(initialHasMore)
  const [readsToday,  setReadsToday]  = useState(initialReadsToday)

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (cat: string, pg: number, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    try {
      const res  = await fetch(`/api/news?category=${cat}&page=${pg}&limit=20`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setArticles(prev => append ? [...prev, ...json.data] : json.data)
      setHasMore(json.hasMore)
    } catch {
      toast.error("Failed to load news")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  const switchCategory = useCallback((cat: string) => {
    if (cat === category) return
    setCategory(cat)
    setPage(1)
    fetchPage(cat, 1)
  }, [category, fetchPage])

  const loadMore = useCallback(() => {
    const next = page + 1
    setPage(next)
    fetchPage(category, next, true)
  }, [page, category, fetchPage])

  // ── Read tracking ──────────────────────────────────────────────────────────

  const handleOpen = useCallback(async (article: NewsArticle) => {
    // Open immediately — don't make the user wait for tracking
    window.open(article.article_url, "_blank", "noopener,noreferrer")
    if (article.read) return

    // Fire read in background
    try {
      const res  = await fetch(`/api/news/${article.id}/read`, { method: "POST" })
      if (!res.ok) return
      const json = await res.json()

      // Mark as read locally
      setArticles(prev =>
        prev.map(a => a.id === article.id ? { ...a, read: true } : a)
      )

      if (json.credited) {
        setReadsToday(prev => prev + 1)
        toast.success(`+₦${(json.kobo / 100).toFixed(2)} earned!`, {
          description: "Credited for reading an article.",
          duration: 3000,
        })
      }
    } catch {
      // Fail silently — don't block the user
    }
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  const capProgress = settings.earnEnabled
    ? Math.min((readsToday / settings.earnDailyCap) * 100, 100)
    : 0
  const capHit = readsToday >= settings.earnDailyCap

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-primary" />
            Nigerian News
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Punch · Vanguard · BusinessDay · Guardian NG · Pulse NG — updated every 30 minutes.
          </p>
        </div>
        {settings.earnEnabled && (
          <Badge
            variant="outline"
            className="whitespace-nowrap shrink-0 text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
          >
            <TrendingUp className="w-3 h-3 mr-1" />
            Earn ₦{(settings.earnKoboPerRead / 100).toFixed(2)}/article
          </Badge>
        )}
      </div>

      {/* Earn progress */}
      {settings.earnEnabled && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Articles read today</span>
            <span className="font-semibold tabular-nums">
              {readsToday}
              <span className="text-muted-foreground font-normal"> / {settings.earnDailyCap}</span>
            </span>
          </div>
          <Progress value={capProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {capHit
              ? "Daily reading limit reached — resets at midnight UTC."
              : `Open up to ${settings.earnDailyCap} articles today to earn ₦${((settings.earnDailyCap * settings.earnKoboPerRead) / 100).toFixed(2)}.`
            }
          </p>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => switchCategory(value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              category === value
                ? "bounty-gradient text-white border-transparent shadow-sm"
                : "border-border bg-card hover:border-primary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border p-4 flex gap-4">
              <Skeleton className="w-24 h-20 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-3">
          <Newspaper className="w-10 h-10 mx-auto opacity-30" />
          <p className="font-medium">No articles yet in this category.</p>
          <Button variant="outline" size="sm" onClick={() => fetchPage(category, 1)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article, index) => (
            <div key={article.id}>
              {/* Native ad slot placeholder every 6 articles */}
              {index > 0 && index % 6 === 0 && (
                <div className="h-px bg-border my-1" aria-hidden="true" />
              )}

              <article
                className={`group rounded-2xl border bg-card transition-all duration-200 overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-sm ${
                  article.read ? "opacity-60" : ""
                }`}
                onClick={() => handleOpen(article)}
              >
                <div className="p-4 flex gap-4">
                  {/* Thumbnail */}
                  {article.thumbnail_url && (
                    <div className="w-24 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={article.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={e => {
                          const el = e.currentTarget as HTMLImageElement
                          el.parentElement?.classList.add("hidden")
                        }}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${
                          CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES.general
                        }`}
                      >
                        {article.category}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {article.source_name}
                      </span>
                      {article.published_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
                        </span>
                      )}
                      {article.read && (
                        <span className="text-[10px] text-muted-foreground/60 italic">read</span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-1">
                      {article.title}
                    </h3>

                    {/* Snippet */}
                    {article.snippet && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">
                        {article.snippet}
                      </p>
                    )}

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <ExternalLink className="w-3 h-3" />
                      Read full article
                    </span>
                  </div>
                </div>
              </article>
            </div>
          ))}

          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more articles"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
