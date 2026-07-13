import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getHideoutSettings } from "@/lib/hideout"
import { getAdCompletionsTodayCount } from "@/lib/ad-providers"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tv, Info } from "lucide-react"
import HideoutWidget from "./HideoutWidget"

export default async function WatchVideosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const [settings, usedToday] = await Promise.all([
    getHideoutSettings(),
    getAdCompletionsTodayCount(user.id, "hideout"),
  ])

  const capHit = usedToday >= settings.dailyCap

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tv className="w-6 h-6" /> Watch Videos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Earn ₦{(settings.rewardKobo / 100).toFixed(0)} per qualifying viewing session — just watch and earn.
          </p>
        </div>
        <Badge variant="outline" className="whitespace-nowrap shrink-0">
          Powered by HideoutTV
        </Badge>
      </div>

      {settings.enabled && settings.publisherId && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Today&apos;s sessions</span>
              <span className="font-medium tabular-nums">{usedToday} / {settings.dailyCap}</span>
            </div>
            <Progress value={(usedToday / settings.dailyCap) * 100} className="h-2" />
            {capHit && (
              <p className="text-xs text-muted-foreground">Daily limit reached. Resets at midnight UTC.</p>
            )}
          </CardContent>
        </Card>
      )}

      {!settings.enabled || !settings.publisherId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coming Soon</CardTitle>
            <CardDescription>Video watching tasks aren&apos;t available yet. Check back later.</CardDescription>
          </CardHeader>
        </Card>
      ) : capHit ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Tv className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="font-medium">All sessions complete for today!</p>
            <p className="text-sm text-muted-foreground">
              You&apos;ve watched {settings.dailyCap} session{settings.dailyCap === 1 ? "" : "s"} today.
              Come back tomorrow.
            </p>
          </CardContent>
        </Card>
      ) : (
        <HideoutWidget publisherId={settings.publisherId} userId={user.id} />
      )}

      <Card className="bg-muted/40">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1">
            <Info className="w-3 h-3" /> How it works
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Watch videos in the player below for a qualifying duration (typically 60–90 seconds).</li>
            <li>A session is credited automatically by HideoutTV after you meet the minimum watch time.</li>
            <li>Daily limit: {settings.dailyCap} sessions per day; reward: ₦{(settings.rewardKobo / 100).toFixed(0)} per session.</li>
            <li>Rewards appear in your earnings ledger within a few seconds of session completion.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
