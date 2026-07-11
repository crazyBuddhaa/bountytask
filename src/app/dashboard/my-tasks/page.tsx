"use client"
import { useState, useEffect, useCallback } from "react"
import { CheckCircle2, Clock, XCircle, Flag, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import type { TaskCompletion } from "@/types"

type CompletionWithTask = TaskCompletion & {
  task: { title: string; reward_amount: number; type: string }
}

const statusConfig = {
  approved:  { icon: CheckCircle2, label: "Approved",  variant: "success"     as const, color: "text-emerald-600" },
  pending:   { icon: Clock,        label: "Pending",   variant: "pending"     as const, color: "text-blue-600"   },
  rejected:  { icon: XCircle,      label: "Rejected",  variant: "destructive" as const, color: "text-destructive"},
  flagged:   { icon: Flag,         label: "Flagged",   variant: "warning"     as const, color: "text-amber-600"  },
}

export default function MyTasksPage() {
  const [completions, setCompletions] = useState<CompletionWithTask[]>([])
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage]               = useState(1)
  const [total, setTotal]             = useState(0)
  const limit = 20

  const fetchCompletions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (statusFilter) params.set("status", statusFilter)

    const res  = await fetch(`/api/my-tasks?${params}`)
    const json = await res.json()
    setCompletions(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { fetchCompletions() }, [fetchCompletions])

  const counts = {
    approved: completions.filter(c => c.status === "approved").length,
    pending:  completions.filter(c => c.status === "pending").length,
    rejected: completions.filter(c => c.status === "rejected").length,
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <p className="text-muted-foreground text-sm mt-1">All your task submissions and their review status.</p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {(["approved","pending","rejected"] as const).map(s => {
          const cfg = statusConfig[s]
          return (
            <button
              key={s}
              onClick={() => { setStatusFilter(statusFilter === s ? "" : s); setPage(1) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all
                ${statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/40"}`}
            >
              <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
              {cfg.label}
              <span className="text-xs font-bold">{counts[s]}</span>
            </button>
          )
        })}
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-36 h-9">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : completions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No submissions yet.</p>
          <p className="text-sm mt-1">Head to the task marketplace to start earning.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {completions.map(c => {
            const cfg = statusConfig[c.status] ?? statusConfig.pending
            const Icon = cfg.icon
            return (
              <Card key={c.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0
                      ${c.status === "approved" ? "bg-emerald-50" : c.status === "pending" ? "bg-blue-50" : "bg-red-50"}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.task?.title ?? "Task"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Submitted {formatDateTime(c.submitted_at)}
                      </p>
                      {c.rejection_reason && (
                        <p className="text-xs text-destructive mt-1 font-medium">
                          Reason: {c.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    <span className={`font-bold text-sm ${c.status === "approved" ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {c.status === "approved" ? "+" : ""}{formatCurrency(c.task?.reward_amount ?? 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
