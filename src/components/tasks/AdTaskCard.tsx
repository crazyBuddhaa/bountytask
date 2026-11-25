import Link from "next/link"
import { Zap, ArrowRight, Gauge, Clock } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import type { AdTaskStatus } from "@/lib/ad-providers"

interface AdTaskCardProps {
  task: AdTaskStatus
}

/**
 * Renders an ad-provider task (video ad, offer wall, survey, etc.) as a card
 * in the Available Tasks grid, matching the look of a regular TaskCard.
 * Unlike TaskCard, clicking it navigates to the provider's dedicated page
 * instead of opening the completion modal, since these tasks are fulfilled
 * by an external widget/iframe/SDK.
 */
export function AdTaskCard({ task }: AdTaskCardProps) {
  return (
    <Card className="flex flex-col hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group border-primary/20">
      <CardContent className="p-5 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Badge variant="success" className="text-[10px]">
              <Zap className="w-2.5 h-2.5" />Instant
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1 tabular-nums text-muted-foreground">
              <Clock className="w-2.5 h-2.5" /> ~30s
            </Badge>
          </div>
        </div>

        <h3 className="font-semibold text-sm leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {task.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>

        <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-muted-foreground tabular-nums">
          <Gauge className="w-2.5 h-2.5" />
          {task.usedToday}/{task.dailyCap} used today
          {task.capReached && <span className="text-destructive font-medium">· limit reached</span>}
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-3 flex items-center justify-between border-t mt-2 gap-2">
        <div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-base tabular-nums">
            {task.rewardKobo !== null ? formatCurrency(task.rewardKobo) : "Varies"}
          </span>
          <p className="text-[10px] text-muted-foreground mt-1">per completion</p>
        </div>
        <Button size="sm" variant="gradient" className="gap-1 shrink-0" disabled={task.capReached} asChild={!task.capReached}>
          {task.capReached ? (
            <span>Limit reached</span>
          ) : (
            <Link href={task.href}>
              Start <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
