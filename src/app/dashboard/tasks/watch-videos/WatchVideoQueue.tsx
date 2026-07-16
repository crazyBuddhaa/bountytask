"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, ChevronRight, PartyPopper } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import WatchVideoClient from "./WatchVideoClient"
import type { Task } from "@/types"

interface Props {
  remaining: number
}

export default function WatchVideoQueue({ remaining: initialRemaining }: Props) {
  const [task, setTask]           = useState<Task | null | undefined>(undefined) // undefined = loading
  const [claimed, setClaimed]     = useState(false)
  const [totalEarned, setTotalEarned] = useState(0)
  const [remaining, setRemaining] = useState(initialRemaining)

  const fetchNext = useCallback(async () => {
    setTask(undefined) // loading
    setClaimed(false)
    const res = await fetch("/api/tasks/video/next")
    const json = await res.json()
    setTask(json.data ?? null)
  }, [])

  useEffect(() => { fetchNext() }, [fetchNext])

  function handleClaimed() {
    if (!task) return
    setClaimed(true)
    setTotalEarned(prev => prev + task.reward_amount)
    setRemaining(prev => Math.max(prev - 1, 0))
  }

  // Loading
  if (task === undefined) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  // All done
  if (task === null) {
    return (
      <Card className="text-center">
        <CardContent className="p-8 space-y-3">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <PartyPopper className="w-7 h-7 text-emerald-600" />
            </div>
          </div>
          <CardTitle className="text-lg">You&apos;re all caught up!</CardTitle>
          <CardDescription>
            No new videos right now. Check back later — new videos are added regularly.
          </CardDescription>
          {totalEarned > 0 && (
            <p className="text-sm font-medium text-emerald-600">
              You earned {formatCurrency(totalEarned)} this session 🎉
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Claimed — show next prompt
  if (claimed) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-6 space-y-4 text-center">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="font-semibold text-emerald-800">
              {formatCurrency(task.reward_amount)} credited!
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {remaining > 0
                ? `${remaining} more video${remaining === 1 ? "" : "s"} waiting for you.`
                : "That was the last one — check back soon for more."}
            </p>
          </div>
          {remaining > 0 && (
            <Button onClick={fetchNext} className="gap-2">
              Watch Next <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Active video
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base leading-snug">{task.title}</CardTitle>
            {task.description && (
              <CardDescription className="mt-1 text-xs line-clamp-2">{task.description}</CardDescription>
            )}
          </div>
          <Badge variant="success" className="shrink-0 text-[10px]">
            +{formatCurrency(task.reward_amount)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <WatchVideoClient task={task} onClaimed={handleClaimed} />
      </CardContent>
    </Card>
  )
}
