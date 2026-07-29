/**
 * Cron endpoint: pull fresh articles from all RSS feeds and store them.
 *
 * Called by GitHub Actions every 30 minutes.
 * Authenticated by the shared CRON_SECRET header (same pattern as process-tasks).
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchAndStoreFeeds } from "@/lib/news"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results = await fetchAndStoreFeeds()

  const totalFetched  = results.reduce((sum, r) => sum + r.fetched,  0)
  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0)
  const totalDeleted  = results.reduce((sum, r) => sum + r.deleted,  0)
  const errors        = results.filter(r => r.error).map(r => ({ source: r.source, error: r.error }))

  // Audit log entry (actor_id null = system/cron)
  const admin = createAdminClient()
  await admin.from("audit_logs").insert({
    actor_id:    null,
    action:      "cron.fetch_news",
    target_type: "news_articles",
    target_id:   null,
    details:     { totalFetched, totalInserted, totalDeleted, sources: results },
    ip_address:  null,
  })

  return NextResponse.json({ totalFetched, totalInserted, totalDeleted, sources: results, errors })
}
