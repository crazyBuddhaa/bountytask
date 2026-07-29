"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ExternalLink, Newspaper, Clock, RefreshCw,
  ChevronDown, TrendingUp, Coins, CheckCircle2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Main client ──────────────────────────────────────────────────────────────

export function NewsClient({ initialArticles, initialHasMore, settings, readsToday }: Props) {
  const router = useRouter()

  const [articles, setArticles]   = useState<NewsArticle[]>(initialArticles)
  const [hasMore, setHasMore]     = useState(initialHasMore)
  const [category, setCategory]   = useState("all")
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // ── Category switch ────────────────────────────────────────────────────────
  const switchCategory = useCallback(async (cat: string) => {
    if (cat === category) return
    setCategory(cat)
    setLoading(true)
    setPage(1)

    const qs  = new URLSearchParams({ category: cat, page: "1", limit: "20" })
    const res = await fetch(`/api/news?${qs}`)
    const json = await res.json()

    setArticles(json.data ?? [])
    setHasMore(json.hasMore ?? false)
    setLoading(false)
  }, [category])

  // ── Load more ──────────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    const nextPage = page + 1
    setLoadingMore(true)

    const qs  = new URLSearchParams({ category, page: String(nextPage), limit: "20" })
    const res = await fetch(`/api/news?${qs}`)
    const json = await res.json()

    setArticles(prev => [...prev, ...(json.data ?? [])])
    setHasMore(json.hasMore ?? false)
    setPage(nextPage)
    setLoadingMore(false)
  }, [category, page])

  const fmt = (kobo: number) => `₦${(kobo / 100).toFixed(2)}`

  const dailyCap     = settings.earnDailyCapMinutes ?? 30
  const koboPerMin   = settings.earnKoboPerMinute   ?? 200
  const maxEarnToday = fmt(dailyCap * koboPerMin)

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-primary" />
            News Feed
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nigerian news from trusted sources. Read and earn.
          </p>
        </div>

        {/* Earn info badge */}
        {settings.earnEnabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2 text-sm">
            <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
              <Coins className="w-4 h-4" />
              Earn {fmt(koboPerMin)}/minute you read
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Up to {maxEarnToday}/day · max {settings.earnMaxMinutesPerArticle ?? 5} min per article
            </p>
          </div>
        )}
      </div>

      {/* ── Category tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => switchCategory(cat.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              category === cat.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Article grid ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border p-4 space-y-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Newspaper className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-semibold">No articles yet</p>
          <p className="text-sm text-muted-foreground">
            The news feed is refreshed every 30 minutes. Check back shortly.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {articles.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              earnEnabled={settings.earnEnabled}
              onClick={() => router.push(`/dashboard/news/${article.id}`)}
            />
          ))}
        </div>
      )}

      {/* ── Load more ─────────────────────────────────────────────────── */}
      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
            className="gap-2"
          >
            {loadingMore ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({
  article,
  earnEnabled,
  onClick,
}: {
  article:     NewsArticle
  earnEnabled: boolean
  onClick:     () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Thumbnail */}
      {article.thumbnail_url ? (
        <div className="relative overflow-hidden bg-muted h-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.thumbnail_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { (e.currentTarget as HTMLImageElement).parentElement?.classList.add("hidden") }}
          />
          {article.read && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-white font-medium">Read</span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-20 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          <Newspaper className="w-8 h-8 text-muted-foreground/40" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-2">
        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${
            CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES.general
          }`}>
            {article.category}
          </span>
          <span className="text-xs text-muted-foreground">{article.source_name}</span>
          {article.published_at && (
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-3">
          {article.title}
        </h3>

        {/* Snippet */}
        {article.snippet && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {article.snippet}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          {earnEnabled && !article.read ? (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-medium">
              <Coins className="w-3 h-3" />
              Earn while reading
            </span>
          ) : article.read ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Already read
            </span>
          ) : (
            <span />
          )}
          <span className="text-xs text-primary font-medium flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
            Read more <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </button>
  )
}
