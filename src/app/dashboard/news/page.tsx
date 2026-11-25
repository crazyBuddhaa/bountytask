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
  const [articlesRes, readsRes] = await Promise.all([
    admin
      .from("news_articles")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(20),

    admin
      .from("news_reads")
      .select("article_id")
      .eq("user_id", user.id)
      .limit(500),
  ])

  const readSet  = new Set((readsRes.data ?? []).map(r => r.article_id))
  const articles = (articlesRes.data ?? []).map(a => ({ ...a, read: readSet.has(a.id) }))
  const hasMore  = (articlesRes.count ?? 0) > articles.length

  return (
    <NewsClient
      initialArticles={articles}
      initialHasMore={hasMore}
      settings={settings}
    />
  )
}
