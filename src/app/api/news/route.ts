/**
 * GET /api/news
 *
 * Returns a paginated list of active news articles.
 * Optionally filters by category.
 * Also returns the authenticated user's read article IDs so the client
 * can mark already-read cards without a separate request.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const VALID_CATEGORIES = new Set([
  "all", "politics", "business", "tech", "sports", "entertainment", "general",
])

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sp       = new URL(request.url).searchParams
  const page     = Math.max(1, Number(sp.get("page"))  || 1)
  const limit    = Math.min(20, Number(sp.get("limit")) || 20)
  const category = sp.get("category") || "all"

  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const offset = (page - 1) * limit
  const admin  = createAdminClient()

  let query = admin
    .from("news_articles")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (category !== "all") query = query.eq("category", category)

  const { data: articles, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch user reads for only the returned articles (avoids full-table scan)
  const articleIds = (articles ?? []).map(a => a.id)
  const readSet    = new Set<string>()

  if (articleIds.length > 0) {
    const { data: reads } = await admin
      .from("news_reads")
      .select("article_id")
      .eq("user_id", user.id)
      .in("article_id", articleIds)

    for (const r of reads ?? []) readSet.add(r.article_id)
  }

  return NextResponse.json({
    data:    (articles ?? []).map(a => ({ ...a, read: readSet.has(a.id) })),
    total:   count ?? 0,
    page,
    limit,
    hasMore: (count ?? 0) > offset + limit,
  })
}
