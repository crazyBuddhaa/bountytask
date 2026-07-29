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
  enabled:         boolean
  earnEnabled:     boolean
  earnKoboPerRead: number
  earnDailyCap:    number
}

export const getNewsSettings = unstable_cache(
  async (): Promise<NewsSettings> => {
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", ["news_enabled", "news_earn_enabled", "news_earn_kobo_per_read", "news_earn_daily_cap"])

    const map = Object.fromEntries((rows ?? []).map(r => [r.key, r.value]))

    const parseBool = (v: unknown) => v === "true" || v === true
    return {
      enabled:         parseBool(map.news_enabled),
      earnEnabled:     parseBool(map.news_earn_enabled),
      earnKoboPerRead: Number(map.news_earn_kobo_per_read) || 5,
      earnDailyCap:    Number(map.news_earn_daily_cap)     || 20,
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
  if (/tech|technology|startup|software|app|internet|data|cyber|artificial intelligence|ai /.test(text)) return "tech"
  if (/football|soccer|sport|nfl|nba|athlete|match|goal|league|tournament|supereagles/.test(text)) return "sports"
  if (/music|nollywood|actor|actress|celebrity|movie|film|entertainment|concert|award|bbnaija/.test(text)) return "entertainment"
  return "general"
}

/** Parse all <item> blocks from an RSS XML string. */
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRe.exec(xml)) !== null) {
    const chunk = match[1]

    const title = getTagContent(chunk, "title")
    if (!title) continue

    // Link resolution: <link>, <link href="...">, or <guid isPermaLink="true">
    let link: string | null = getTagContent(chunk, "link")
    if (!link) link = getAttr(chunk, "link", "href")
    if (!link) {
      const guidM = /<guid[^>]*>([^<]+)<\/guid>/i.exec(chunk)
      if (guidM && guidM[1].trim().startsWith("http")) link = guidM[1].trim()
    }
    if (!link) continue

    const rawDesc = getTagContent(chunk, "description") ?? ""
    const snippet = rawDesc ? stripHtml(rawDesc) : null

    // Thumbnail priority: media:content > media:thumbnail > enclosure
    const thumbnail =
      getAttr(chunk, "media:content",   "url") ??
      getAttr(chunk, "media:thumbnail", "url") ??
      getAttr(chunk, "enclosure",       "url") ??
      null

    const pubDate = getTagContent(chunk, "pubDate") ?? null

    items.push({ title, link, snippet, thumbnail, pubDate })
  }

  return items
}

// ─── Fetch & store ────────────────────────────────────────────────────────────

export interface FeedResult {
  source:   string
  fetched:  number
  inserted: number
  error?:   string
}

/**
 * Fetches all configured RSS feeds, parses them, and upserts new articles into
 * the news_articles table. Existing articles (by URL) are silently skipped.
 * Articles older than 7 days are pruned after each run.
 */
export async function fetchAndStoreFeeds(): Promise<FeedResult[]> {
  const admin   = createAdminClient()
  const results: FeedResult[] = []

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "BountyTask/1.0 (+https://bountytask.dpdns.org)" },
        signal:  AbortSignal.timeout(10_000),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const xml   = await res.text()
      const items = parseRssItems(xml)

      if (items.length === 0) {
        results.push({ source: feed.name, fetched: 0, inserted: 0 })
        continue
      }

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

      const { error, count } = await admin
        .from("news_articles")
        .upsert(rows, { onConflict: "article_url", ignoreDuplicates: true, count: "exact" })

      results.push({
        source:   feed.name,
        fetched:  items.length,
        inserted: count ?? 0,
        error:    error?.message,
      })
    } catch (err) {
      results.push({ source: feed.name, fetched: 0, inserted: 0, error: String(err) })
    }
  }

  // Prune articles older than 7 days to keep the table small
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  await admin
    .from("news_articles")
    .delete()
    .lt("published_at", cutoff.toISOString())

  return results
}
