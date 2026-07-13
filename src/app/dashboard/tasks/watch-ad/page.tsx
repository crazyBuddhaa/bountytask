import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAdProviderSettings, getAdCompletionsTodayCount } from "@/lib/ad-providers"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { PlayCircle, ShieldCheck, Zap } from "lucide-react"
import WatchAdClient from "./WatchAdClient"

export default async function WatchAdPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const [settings, usedToday] = await Promise.all([
    getAdProviderSettings(),
    getAdCompletionsTodayCount(user.id, "ima"),
  ])

  const ima = settings.ima
  const capHit = usedToday >= ima.dailyCap

  if (!ima.enabled || !ima.adTagUrl) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PlayCircle className="w-6 h-6" /> Watch an Ad
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Earn ₦ by watching a short video advertisement.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coming Soon</CardTitle>
            <CardDescription>Video ad tasks aren&apos;t available yet. Check back later.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PlayCircle className="w-6 h-6" /> Watch an Ad
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Earn {(ima.rewardKobo / 100).toFixed(2).replace(/\.?0+$/, "")
              .replace(/^(\d+\.\d{1,2}).*$/, "$1")} ₦ per video ad watched to completion.
          </p>
        </div>
        <Badge variant="outline" className="whitespace-nowrap shrink-0">
          <Zap className="w-2.5 h-2.5" /> Instant
        </Badge>
      </div>

      {/* Daily cap progress */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Today&apos;s ads watched</span>
            <span className="font-medium tabular-nums">{usedToday} / {ima.dailyCap}</span>
          </div>
          <Progress value={(usedToday / ima.dailyCap) * 100} className="h-2" />
          {capHit && (
            <p className="text-xs text-muted-foreground">Daily limit reached. Resets at midnight UTC.</p>
          )}
        </CardContent>
      </Card>

      {/* IMA player — client component handles all SDK interactions */}
      <WatchAdClient
        initialCap={{ used: usedToday, cap: ima.dailyCap }}
        rewardKobo={ima.rewardKobo}
      />

      <Card className="bg-muted/40">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Rules
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Watch the entire ad — skipping or closing it before completion earns nothing.</li>
            <li>Do not use automation tools or browser extensions that skip ads.</li>
            <li>Limit: {ima.dailyCap} ad{ima.dailyCap === 1 ? "" : "s"} per day.</li>
            <li>Reward is credited immediately after the ad finishes.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
