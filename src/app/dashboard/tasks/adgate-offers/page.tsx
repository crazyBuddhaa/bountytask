import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAdGateSettings, buildAdGateWallUrl } from "@/lib/adgate"
import { getAdCompletionsTodayCount } from "@/lib/ad-providers"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Gift, Info, Zap } from "lucide-react"

export default async function AdGateOffersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const [settings, usedToday] = await Promise.all([
    getAdGateSettings(),
    getAdCompletionsTodayCount(user.id, "adgate"),
  ])

  const capHit = usedToday >= settings.dailyCap

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="w-6 h-6" /> AdGate Rewards Wall
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete offers, app installs, and sign-ups from the AdGate rewards wall.
          </p>
        </div>
        <Badge variant="outline" className="whitespace-nowrap shrink-0">
          <Zap className="w-2.5 h-2.5" /> Instant
        </Badge>
      </div>

      {/* Daily cap progress */}
      {settings.enabled && settings.wallId && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Today&apos;s completions</span>
              <span className="font-medium tabular-nums">{usedToday} / {settings.dailyCap}</span>
            </div>
            <Progress value={(usedToday / settings.dailyCap) * 100} className="h-2" />
            {capHit && (
              <p className="text-xs text-muted-foreground">
                You&apos;ve reached today&apos;s limit. Resets at midnight UTC.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Offer wall */}
      {!settings.enabled || !settings.wallId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coming Soon</CardTitle>
            <CardDescription>
              Offer tasks aren&apos;t available yet. Check back later.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : capHit ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Gift className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="font-medium">All done for today!</p>
            <p className="text-sm text-muted-foreground">
              You&apos;ve hit the daily limit of {settings.dailyCap} offer{settings.dailyCap === 1 ? "" : "s"}.
              Come back tomorrow.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <iframe
            src={buildAdGateWallUrl(settings.wallId, user.id)}
            className="w-full"
            style={{ height: 640, border: "none" }}
            title="AdGate Rewards Wall"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
          />
        </Card>
      )}

      <Card className="bg-muted/40">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1">
            <Info className="w-3 h-3" /> Tips for earning
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Use accurate information — misleading responses can disqualify your account.</li>
            <li>Rewards are credited by the advertiser and usually arrive within minutes.</li>
            <li>Some offers may not be available in your region; this is normal.</li>
            <li>Daily limit: {settings.dailyCap} completions per day.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
