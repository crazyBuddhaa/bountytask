import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getLootablySettings } from "@/lib/lootably"
import { getAdCompletionsTodayCount } from "@/lib/ad-providers"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { LayoutGrid, Info } from "lucide-react"
import LootablyWidget from "./LootablyWidget"

export default async function MixedOffersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const [settings, usedToday] = await Promise.all([
    getLootablySettings(),
    getAdCompletionsTodayCount(user.id, "lootably"),
  ])

  const capHit = usedToday >= settings.dailyCap

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6" /> Mixed Offers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Surveys, app installs, sign-ups, and more — all in one place.
          </p>
        </div>
        <Badge variant="outline" className="whitespace-nowrap shrink-0">
          Powered by Lootably
        </Badge>
      </div>

      {settings.enabled && settings.apiKey && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Today&apos;s completions</span>
              <span className="font-medium tabular-nums">{usedToday} / {settings.dailyCap}</span>
            </div>
            <Progress value={(usedToday / settings.dailyCap) * 100} className="h-2" />
            {capHit && (
              <p className="text-xs text-muted-foreground">Daily limit reached. Resets at midnight UTC.</p>
            )}
          </CardContent>
        </Card>
      )}

      {!settings.enabled || !settings.apiKey ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coming Soon</CardTitle>
            <CardDescription>Mixed offer tasks aren&apos;t available yet. Check back later.</CardDescription>
          </CardHeader>
        </Card>
      ) : capHit ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <LayoutGrid className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="font-medium">All done for today!</p>
            <p className="text-sm text-muted-foreground">
              You&apos;ve hit today&apos;s limit of {settings.dailyCap} offer{settings.dailyCap === 1 ? "" : "s"}. Come back tomorrow.
            </p>
          </CardContent>
        </Card>
      ) : (
        <LootablyWidget apiKey={settings.apiKey} userId={user.id} />
      )}

      <Card className="bg-muted/40">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1">
            <Info className="w-3 h-3" /> Tips
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Choose offers that match your interests for best completion rates.</li>
            <li>Rewards are credited by the advertiser — usually within seconds to a few minutes.</li>
            <li>Not all offers are available in every region.</li>
            <li>Daily limit: {settings.dailyCap} completions per day.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
