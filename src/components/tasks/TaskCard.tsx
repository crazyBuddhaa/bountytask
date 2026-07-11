import { Clock, Zap, Users, ArrowRight } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import type { Task } from "@/types"

interface TaskCardProps {
  task: Task
  onClaim: () => void
}

export function TaskCard({ task, onClaim }: TaskCardProps) {
  const spotsLeft = task.max_completions !== null
    ? task.max_completions - task.current_completions
    : null
  const isInstant = task.type === "unverified"

  return (
    <Card className="flex flex-col hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group">
      <CardContent className="p-5 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Badge variant={isInstant ? "success" : "pending"} className="text-[10px]">
            {isInstant ? <><Zap className="w-2.5 h-2.5" />Instant</> : <><Clock className="w-2.5 h-2.5" />Verified</>}
          </Badge>
          {task.category && (
            <span className="text-xs text-muted-foreground">{task.category.icon ?? "🎯"} {task.category.name}</span>
          )}
        </div>

        <h3 className="font-semibold text-sm leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {task.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>

        {task.requires_proof && (
          <p className="text-[10px] text-amber-600 mt-2 font-medium">⚠ Proof of completion required</p>
        )}
      </CardContent>

      <CardFooter className="p-5 pt-0 flex items-center justify-between border-t mt-2">
        <div>
          <p className="text-lg font-bold text-primary">{formatCurrency(task.reward_amount)}</p>
          {spotsLeft !== null && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="w-2.5 h-2.5" />{spotsLeft.toLocaleString()} spots left
            </p>
          )}
        </div>
        <Button size="sm" variant="gradient" onClick={onClaim} className="gap-1">
          Claim <ArrowRight className="w-3 h-3" />
        </Button>
      </CardFooter>
    </Card>
  )
}
