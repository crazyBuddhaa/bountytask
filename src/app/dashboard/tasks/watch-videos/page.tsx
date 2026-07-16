import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Youtube, Zap, CheckCircle } from "lucide-react"
import WatchVideoQueue from "./WatchVideoQueue"

export default async function WatchVideosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const admin = createAdminClient()

  // Count total active video tasks
  const { count: totalVideos } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .not("youtube_url", "is", null)

  // Count how many this user has already completed
  const { data: completedIds } = await admin
    .from("task_completions")
    .select("task_id, tasks!inner(youtube_url)")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved"])
    .not("tasks.youtube_url", "is", null)

  const watchedCount = completedIds?.length ?? 0
  const remaining    = Math.max((totalVideos ?? 0) - watchedCount, 0)

  return (
    <div className="max-w-2xl space-y-6">
      <Header />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total videos",   value: totalVideos ?? 0 },
          { label: "Watched",        value: watchedCount },
          { label: "Remaining",      value: remaining },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Queue player — client component handles the interactive part */}
      <WatchVideoQueue remaining={remaining} />
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Youtube className="w-6 h-6 text-red-500" /> Watch &amp; Earn
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Watch videos to the end and earn ₦ instantly — one reward per video.
        </p>
      </div>
      <Badge variant="outline" className="whitespace-nowrap shrink-0">
        <Zap className="w-2.5 h-2.5 mr-1" /> Instant Pay
      </Badge>
    </div>
  )
}
