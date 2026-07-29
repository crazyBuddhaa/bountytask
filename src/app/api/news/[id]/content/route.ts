/**
 * GET /api/news/[id]/content
 *
 * Returns the full extracted text of an article.
 * On first call the article URL is fetched, the main body is extracted and
 * stored in news_articles.content so every subsequent call is instant.
 *
 * The client displays ~65 % of the text inline with an ad slot at the split
 * point, then a hard link to the original publisher for the remainder.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// Lightweight article-body extractor
// ---------------------------------------------------------------------------

/** Strip HTML tags, decode common entities, collapse whitespace. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Pull the most relevant block of text from raw HTML.
 * Priority: <article> → <main> → largest <div class="*content*"> → <body>
 * Caps at 8 000 characters (plenty for 65 % display + overflow CTA).
 */
function extractBody(html: string): string {
  // Try <article> first
  const articleM = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html)
  if (articleM) return stripHtml(articleM[1]).slice(0, 8000)

  // Try <main>
  const mainM = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)
  if (mainM) return stripHtml(mainM[1]).slice(0, 8000)

  // Try a div whose class contains "content", "article", "post", or "story"
  const divM = /<div[^>]*class="[^"]*(?:content|article|post|story|entry)[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)
  if (divM) return stripHtml(divM[1]).slice(0, 8000)

  // Fall back to the full body (will be noisier but still readable)
  const bodyM = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)
  if (bodyM) return stripHtml(bodyM[1]).slice(0, 8000)

  return stripHtml(html).slice(0, 8000)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: articleId } = await params
  const admin = createAdminClient()

  // Fetch the article row (need url + cached content)
  const { data: article } = await admin
    .from("news_articles")
    .select("id, article_url, content")
    .eq("id", articleId)
    .eq("is_active", true)
    .maybeSingle()

  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Return cached content if we already have it
  if (article.content) {
    return NextResponse.json({ content: article.content })
  }

  // Fetch the article page
  let content = ""
  try {
    const res = await fetch(article.article_url, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (compatible; BountyTaskBot/1.0)",
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12_000),
    })

    if (res.ok) {
      const html = await res.text()
      content = extractBody(html)
    }
  } catch {
    // Network failure — return empty so the client degrades gracefully
  }

  // Cache in DB (fire-and-forget, don't block the response)
  if (content) {
    admin
      .from("news_articles")
      .update({ content })
      .eq("id", articleId)
      .then(() => {})
  }

  return NextResponse.json({ content })
}
