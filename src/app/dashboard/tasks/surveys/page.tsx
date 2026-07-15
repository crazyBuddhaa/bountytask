import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCpxSettings, buildCpxSecureHash } from "@/lib/cpx"
import { getAdCompletionsTodayCount } from "@/lib/ad-providers"
import { CpxWidget } from "@/components/cpx-widget"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Zap } from "lucide-react"

export default async function SurveysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const [settings, usedToday] = await Promise.all([
    getCpxSettings(),
    getAdCompletionsTodayCount(user.id, "cpx"),
  ])

  const secureHash = buildCpxSecureHash(user.id, settings.secureHashKey)
  const capHit     = usedToday >= settings.dailyCap

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6" /> Surveys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete short surveys and earn ₦ instantly when your response is accepted.
          </p>
        </div>
        <Badge variant="outline" className="whitespace-nowrap shrink-0">
          <Zap className="w-2.5 h-2.5" /> Instant
        </Badge>
      </div>

      {/* Daily cap progress */}
      {settings.enabled && settings.appId && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Today&apos;s surveys</span>
              <span className="font-medium tabular-nums">{usedToday} / {settings.dailyCap}</span>
            </div>
            <Progress value={(usedToday / settings.dailyCap) * 100} className="h-2" />
            {capHit && (
              <p className="text-xs text-muted-foreground">
                You&apos;ve hit today&apos;s survey limit. Your daily count resets at midnight UTC.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Survey wall */}
      {!settings.enabled || !settings.appId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coming Soon</CardTitle>
            <CardDescription>
              Survey tasks aren&apos;t available yet. Check back later — the admin is setting things up.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : capHit ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="font-medium">All done for today!</p>
            <p className="text-sm text-muted-foreground">
              You&apos;ve completed {settings.dailyCap} survey{settings.dailyCap === 1 ? "" : "s"} today.
              Come back tomorrow for more.
            </p>
          </CardContent>
        </Card>
      ) : (
        <CpxWidget
          appId={settings.appId}
          userId={user.id}
          secureHash={secureHash}
        />
      )}

      <Card className="bg-muted/40">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">How surveys work</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Select a survey from the list above and complete it honestly.</li>
            <li>Rewards are credited automatically once your response is accepted (usually within seconds).</li>
            <li>Some surveys may screen you out — this is normal and you won&apos;t be penalised.</li>
            <li>Daily limit: {settings.dailyCap} surveys per day.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
