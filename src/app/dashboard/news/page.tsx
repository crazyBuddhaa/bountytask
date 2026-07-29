import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNewsSettings } from "@/lib/news"
import { NewsClient } from "./NewsClient"
import { Newspaper } from "lucide-react"

export const metadata = { title: "News — BountyTask" }

export default async function NewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const settings = await getNewsSettings()

  if (!settings.enabled) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-primary" /> News
        </h1>
        <p className="text-muted-foreground">
          The news feed isn&apos;t available yet. Check back later — the admin is setting things up.
        </p>
      </div>
    )
  }

  const admin = createAdminClient()

  // Fetch initial page + user reads in parallel
  const [articlesRes, readsRes, readsTodayRes] = await Promise.all([
    admin
      .from("news_articles")
      .select("*")
      .eq("is_active", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(20),

    admin
      .from("news_reads")
      .select("article_id")
      .eq("user_id", user.id)
      .limit(500),

    (async () => {
      if (!settings.earnEnabled) return { count: 0 }
      const startOfDay = new Date()
      startOfDay.setUTCHours(0, 0, 0, 0)
      return admin
        .from("news_reads")
        .select("id", { count: "exact", head: true })
        .eq("user_id",  user.id)
        .eq("credited", true)
        .gte("read_at", startOfDay.toISOString())
    })(),
  ])

  const readSet  = new Set((readsRes.data ?? []).map(r => r.article_id))
  const articles = (articlesRes.data ?? []).map(a => ({ ...a, read: readSet.has(a.id) }))
  const hasMore  = articles.length === 20

  return (
    <NewsClient
      initialArticles={articles}
      initialHasMore={hasMore}
      settings={settings}
      readsToday={readsTodayRes.count ?? 0}
    />
  )
}
