"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { toast } from "sonner"
import {
  ExternalLink, Newspaper, Clock, TrendingUp, RefreshCw,
  ChevronDown, ChevronUp, X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { AdSlot } from "@/components/ads/AdSlot"
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

// ─── Article reader component ─────────────────────────────────────────────────

interface ArticleReaderProps {
  article:   NewsArticle
  onClose:   () => void
  onCredited: () => void
  earnEnabled:     boolean
  earnKoboPerRead: number
}

function ArticleReader({ article, onClose, onCredited, earnEnabled, earnKoboPerRead }: ArticleReaderProps) {
  const [content,  setContent]  = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const readerRef = useRef<HTMLDivElement>(null)

  // Scroll the reader into view
  useEffect(() => {
    readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  // Fetch content + fire read tracking in parallel on mount
  useEffect(() => {
    let cancelled = false

    const fetchContent = async () => {
      try {
        const res  = await fetch(`/api/news/${article.id}/content`)
        const json = await res.json()
        if (!cancelled) setContent(json.content || null)
      } catch {
        if (!cancelled) setContent(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const trackRead = async () => {
      if (article.read) return
      try {
        const res  = await fetch(`/api/news/${article.id}/read`, { method: "POST" })
        if (!res.ok) return
        const json = await res.json()
        if (json.credited) {
          onCredited()
          toast.success(`+₦${(json.kobo / 100).toFixed(2)} earned!`, {
            description: "Credited for reading an article.",
            duration: 3000,
          })
        }
      } catch { /* silent */ }
    }

    fetchContent()
    trackRead()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id])

  // Split content at 65 %
  const previewText  = content ? content.slice(0, Math.floor(content.length * 0.65)) : null
  const hasMore      = content ? content.length > Math.floor(content.length * 0.65) : false

  return (
    <div ref={readerRef} className="rounded-2xl border border-primary/30 bg-card shadow-sm overflow-hidden">
      {/* Article header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${
                  CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES.general
                }`}
              >
                {article.category}
              </span>
              <span className="text-xs font-medium text-muted-foreground">{article.source_name}</span>
              {article.published_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
                </span>
              )}
            </div>
            <h2 className="font-bold text-base leading-snug">{article.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close reader"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thumbnail */}
        {article.thumbnail_url && (
          <div className="mt-3 rounded-xl overflow-hidden max-h-52 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.thumbnail_url}
              alt={article.title}
              className="w-full object-cover max-h-52"
              onError={e => { (e.currentTarget as HTMLImageElement).parentElement?.classList.add("hidden") }}
            />
          </div>
        )}
      </div>

      {/* Article body */}
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-4/5" : "w-full"}`} />
            ))}
          </div>
        ) : !previewText ? (
          <p className="text-sm text-muted-foreground italic">
            Content preview isn&apos;t available for this article.
          </p>
        ) : (
          <>
            {/* First 65 % of the content */}
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
              {previewText}
            </p>

            {/* ── Inline ad slot ── */}
            <div className="rounded-xl overflow-hidden border border-border">
              <AdSlot placement="news" />
            </div>

            {/* Fade-out teaser for remaining 35 % */}
            {hasMore && (
              <div className="relative">
                <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3 whitespace-pre-line">
                  {content!.slice(Math.floor(content!.length * 0.65))}
                </p>
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
              </div>
            )}
          </>
        )}

        {/* CTA row */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-t border-border">
          <a
            href={article.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bounty-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Read full article on {article.source_name}
          </a>
          {earnEnabled && !article.read && (
            <span className="text-xs text-muted-foreground">
              +₦{(earnKoboPerRead / 100).toFixed(2)} credited for opening this article
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Article card (collapsed) ─────────────────────────────────────────────────

interface ArticleCardProps {
  article:    NewsArticle
  isExpanded: boolean
  onToggle:   () => void
}

function ArticleCard({ article, isExpanded, onToggle }: ArticleCardProps) {
  return (
    <article
      className={`group rounded-2xl border bg-card transition-all duration-200 overflow-hidden cursor-pointer ${
        isExpanded
          ? "border-primary/40 shadow-sm"
          : article.read
            ? "opacity-60 hover:opacity-100 hover:border-primary/30"
            : "hover:border-primary/30 hover:shadow-sm"
      }`}
      onClick={onToggle}
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
              onError={e => { (e.currentTarget as HTMLImageElement).parentElement?.classList.add("hidden") }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${
                CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES.general
              }`}
            >
              {article.category}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{article.source_name}</span>
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

          <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-1">
            {article.title}
          </h3>

          {article.snippet && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">
              {article.snippet}
            </p>
          )}

          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            {isExpanded
              ? <><ChevronUp className="w-3 h-3" /> Collapse</>
              : <><ChevronDown className="w-3 h-3" /> Read article</>
            }
          </span>
        </div>
      </div>
    </article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [expandedId,  setExpandedId]  = useState<string | null>(null)

  // ── Feed fetching ──────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (cat: string, pg: number, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    try {
      const res  = await fetch(`/api/news?category=${cat}&page=${pg}&limit=20`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setArticles(prev => append ? [...prev, ...json.data] : json.data)
      setHasMore(json.hasMore)
      setExpandedId(null)
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

  // ── Article open / collapse ────────────────────────────────────────────────

  const toggleArticle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  const handleCredited = useCallback((articleId: string) => {
    setReadsToday(prev => prev + 1)
    setArticles(prev => prev.map(a => a.id === articleId ? { ...a, read: true } : a))
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
            <div key={article.id} className="space-y-3">
              {/* Ad slot every 6 articles (between cards, not inside them) */}
              {index > 0 && index % 6 === 0 && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <AdSlot placement="news" />
                </div>
              )}

              <ArticleCard
                article={article}
                isExpanded={expandedId === article.id}
                onToggle={() => toggleArticle(article.id)}
              />

              {/* Inline reader — appears directly below the card when expanded */}
              {expandedId === article.id && (
                <ArticleReader
                  article={article}
                  onClose={() => setExpandedId(null)}
                  onCredited={() => handleCredited(article.id)}
                  earnEnabled={settings.earnEnabled && !capHit}
                  earnKoboPerRead={settings.earnKoboPerRead}
                />
              )}
            </div>
          ))}

          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Loading…</>
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
