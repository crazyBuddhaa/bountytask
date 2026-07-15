import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  getAsterraSettings,
  getAsterraLastClickAt,
  ASTERRA_COOLDOWN_MINUTES,
} from "@/lib/asterra"
import { getAdCompletionsTodayCount } from "@/lib/ad-providers"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Info, Zap } from "lucide-react"
import { SmartlinkStartButton } from "./SmartlinkStartButton"

export default async function SmartlinkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const [settings, usedToday, lastClickAt] = await Promise.all([
    getAsterraSettings(),
    getAdCompletionsTodayCount(user.id, "asterra"),
    getAsterraLastClickAt(user.id),
  ])

  const capHit = usedToday >= settings.dailyCap

  // Compute cooldown — pass an ISO string to the client component (serializable)
  let cooldownUntil: string | null = null
  if (lastClickAt) {
    const next = new Date(lastClickAt.getTime() + ASTERRA_COOLDOWN_MINUTES * 60 * 1000)
    if (next > new Date()) cooldownUntil = next.toISOString()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ExternalLink className="w-6 h-6" /> Sponsored Link
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visit a sponsored page and earn an instant reward. No sign-up required.
          </p>
        </div>
        <Badge variant="outline" className="whitespace-nowrap shrink-0">
          <Zap className="w-2.5 h-2.5" /> Instant
        </Badge>
      </div>

      {/* Daily cap progress */}
      {settings.enabled && settings.smartlinkUrl && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Today&apos;s completions</span>
              <span className="font-medium tabular-nums">{usedToday} / {settings.dailyCap}</span>
            </div>
            <Progress value={(usedToday / settings.dailyCap) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Main card */}
      {!settings.enabled || !settings.smartlinkUrl ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coming Soon</CardTitle>
            <CardDescription>
              Sponsored link tasks aren&apos;t available yet. Check back later.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-6">
            <div className="text-center space-y-1">
              <p className="text-3xl font-bold tabular-nums">
                ₦{(settings.rewardKobo / 100).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">per visit</p>
            </div>
            <SmartlinkStartButton
              rewardKobo={settings.rewardKobo}
              cooldownUntil={cooldownUntil}
              capHit={capHit}
            />
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/40">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1">
            <Info className="w-3 h-3" /> How it works
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Click the button — your reward is credited immediately as you visit the page.</li>
            <li>You can earn up to {settings.dailyCap} time{settings.dailyCap === 1 ? "" : "s"} per day from this task.</li>
            <li>There is a {ASTERRA_COOLDOWN_MINUTES}-minute waiting period between visits.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
