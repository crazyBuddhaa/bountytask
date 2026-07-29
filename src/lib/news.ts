/**
 * News Feed — RSS fetching, lightweight XML parsing, and settings helper.
 *
 * No external RSS library is required. The parser handles CDATA, media:content,
 * media:thumbnail, and enclosure thumbnails, which covers every Nigerian outlet
 * in our feed list.
 */

import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"

// ─── RSS feed definitions ─────────────────────────────────────────────────────

const RSS_FEEDS: { url: string; name: string }[] = [
  { url: "https://punchng.com/feed/",              name: "Punch"        },
  { url: "https://www.vanguardngr.com/feed/",      name: "Vanguard"     },
  { url: "https://guardian.ng/feed/",              name: "Guardian NG"  },
  { url: "https://businessday.ng/feed/",           name: "BusinessDay"  },
  { url: "https://www.pulse.ng/rss",               name: "Pulse NG"     },
]

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface NewsSettings {
  enabled:               boolean
  earnEnabled:           boolean
  /** Legacy flat reward per article open — kept for backward compat. */
  earnKoboPerRead:       number
  /** New: reward per minute spent reading. */
  earnKoboPerMinute:     number
  /** Max minutes credited per single article. */
  earnMaxMinutesPerArticle: number
  /** Max total minutes credited per day across all articles. */
  earnDailyCapMinutes:   number
  /** Legacy article daily cap (kept for backward compat). */
  earnDailyCap:          number
}

export const getNewsSettings = unstable_cache(
  async (): Promise<NewsSettings> => {
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "news_enabled",
        "news_earn_enabled",
        "news_earn_kobo_per_read",
        "news_earn_daily_cap",
        "news_earn_kobo_per_minute",
        "news_earn_max_minutes_per_article",
        "news_earn_daily_cap_minutes",
      ])

    const map = Object.fromEntries((rows ?? []).map(r => [r.key, r.value]))

    const parseBool = (v: unknown) => v === "true" || v === true
    return {
      enabled:                  parseBool(map.news_enabled),
      earnEnabled:              parseBool(map.news_earn_enabled),
      earnKoboPerRead:          Number(map.news_earn_kobo_per_read)          || 5,
      earnKoboPerMinute:        Number(map.news_earn_kobo_per_minute)        || 200,
      earnMaxMinutesPerArticle: Number(map.news_earn_max_minutes_per_article) || 5,
      earnDailyCapMinutes:      Number(map.news_earn_daily_cap_minutes)      || 30,
      earnDailyCap:             Number(map.news_earn_daily_cap)              || 20,
    }
  },
  ["news-settings"],
  { revalidate: 60, tags: ["news-settings"] }
)

// ─── Lightweight RSS XML parser ───────────────────────────────────────────────

interface RssItem {
  title:     string
  link:      string
  snippet:   string | null
  thumbnail: string | null
  pubDate:   string | null
}

/** Extract inner text of a named tag, handling CDATA sections. */
function getTagContent(xml: string, tag: string): string | null {
  // CDATA variant: <tag><![CDATA[...]]></tag>
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i")
  const cdataM  = cdataRe.exec(xml)
  if (cdataM) return cdataM[1].trim()

  // Plain text variant: <tag>...</tag> (no child elements, safe for short fields)
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i")
  const plainM  = plainRe.exec(xml)
  return plainM ? plainM[1].trim() : null
}

/** Extract a named attribute from a self-closing or opening tag. */
function getAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["'][^>]*>`, "i")
  const m  = re.exec(xml)
  return m ? m[1] : null
}

/** Strip HTML tags and decode common entities; truncate to maxLen chars. */
function stripHtml(html: string, maxLen = 220): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLen)
}

/** Keyword-based category inference from title + snippet text. */
function inferCategory(title: string, snippet: string | null): string {
  const text = `${title} ${snippet ?? ""}`.toLowerCase()
  if (/politic|senate|house of rep|presidency|governor|election|minister|aso rock|lawmaker/.test(text)) return "politics"
  if (/economy|business|market|stock|naira|inflation|gdp|cbn|investment|banking|trade|revenue/.test(text)) return "business"
  if (/tech|technology|startup|software|app|ai|artificial intelligence|digital|cyber|internet/.test(text)) return "tech"
  if (/sport|football|soccer|nfl|nba|cricket|tennis|olympic|fifa|premier league|laliga/.test(text)) return "sports"
  if (/entertainment|music|movie|film|celebrity|nollywood|award|concert|album/.test(text)) return "entertainment"
  return "general"
}

/** Parse all <item> blocks from an RSS XML string. */
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1]

    const title   = getTagContent(block, "title")
    const link    = getTagContent(block, "link") ?? getTagContent(block, "guid")
    if (!title || !link) continue

    const descRaw = getTagContent(block, "description") ?? getTagContent(block, "summary") ?? ""
    const snippet = descRaw ? stripHtml(descRaw) : null

    // Thumbnail: try media:content, media:thumbnail, then enclosure
    let thumbnail =
      getAttr(block, "media:content", "url") ??
      getAttr(block, "media:thumbnail", "url") ??
      getAttr(block, "enclosure", "url")

    // Filter out non-image enclosures (audio/video)
    if (thumbnail && !/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(thumbnail)) {
      thumbnail = null
    }

    const pubDate = getTagContent(block, "pubDate") ?? getTagContent(block, "dc:date")

    items.push({ title, link, snippet, thumbnail, pubDate })
  }

  return items
}

// ─── Public API ───────────────────────────────────────────────────────────────

interface FeedResult {
  source:   string
  fetched:  number
  inserted: number
  deleted:  number
  error?:   string
}

/**
 * Fetch all configured RSS feeds, parse items, and upsert into news_articles.
 *
 * After each successful feed fetch the function immediately deletes every
 * stored article from that source whose URL is no longer in the live feed.
 * This keeps the table exactly as fresh as the upstream RSS — no 7-day
 * accumulation, no stale rows.
 *
 * Feeds that fail (network error, bad HTTP status, zero items) are skipped
 * for the delete step so a transient outage never wipes good articles.
 */
export async function fetchAndStoreFeeds(): Promise<FeedResult[]> {
  const admin   = createAdminClient()
  const results: FeedResult[] = []

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "BountyTask/1.0 RSS Reader" },
        signal:  AbortSignal.timeout(10_000),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const xml   = await res.text()
      const items = parseRssItems(xml)

      if (items.length === 0) {
        // Feed returned nothing — skip upsert AND delete to avoid wiping articles
        // due to an empty / malformed response.
        results.push({ source: feed.name, fetched: 0, inserted: 0, deleted: 0 })
        continue
      }

      const currentUrls = items.map(i => i.link)

      const rows = items.map(item => ({
        title:         item.title,
        snippet:       item.snippet,
        thumbnail_url: item.thumbnail,
        source_name:   feed.name,
        article_url:   item.link,
        category:      inferCategory(item.title, item.snippet),
        published_at:  item.pubDate ? (() => {
          try { return new Date(item.pubDate!).toISOString() } catch { return null }
        })() : null,
        fetched_at:    new Date().toISOString(),
        is_active:     true,
      }))

      // Upsert fresh articles (skip duplicates so we don't overwrite cached content)
      const { error, count } = await admin
        .from("news_articles")
        .upsert(rows, { onConflict: "article_url", ignoreDuplicates: true, count: "exact" })

      // Delete stale articles for this source — anything not in the live feed right now
      const { count: deleted } = await admin
        .from("news_articles")
        .delete({ count: "exact" })
        .eq("source_name", feed.name)
        .not("article_url", "in", `(${currentUrls.map(u => `"${u}"`).join(",")})`)

      results.push({
        source:   feed.name,
        fetched:  items.length,
        inserted: count   ?? 0,
        deleted:  deleted ?? 0,
        error:    error?.message,
      })
    } catch (err) {
      results.push({ source: feed.name, fetched: 0, inserted: 0, deleted: 0, error: String(err) })
    }
  }

  return results
}
