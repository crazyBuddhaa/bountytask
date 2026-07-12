"use client"
import { useState, useEffect, useCallback } from "react"
import { Check, X, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { TaskSubmission } from "@/types"

const statusVariant: Record<string, "success" | "pending" | "destructive"> = {
  approved: "success", pending: "pending", rejected: "destructive",
}

export default function AdminTaskSubmissionsPage() {
  const [items, setItems]       = useState<TaskSubmission[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const [reviewing, setReviewing] = useState<TaskSubmission | null>(null)
  const [notes, setNotes]       = useState("")
  const [saving, setSaving]     = useState(false)
  const limit = 20

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit), status: statusFilter })
    const res  = await fetch(`/api/admin/task-submissions?${params}`)
    const json = await res.json()
    setItems(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function review(decision: "approve" | "reject") {
    if (!reviewing) return
    setSaving(true)
    const res = await fetch(`/api/admin/task-submissions/${reviewing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, admin_notes: notes || null }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(json.error); return }
    toast.success(decision === "approve" ? "Task created as a draft — activate it from the Tasks page." : "Submission rejected")
    setReviewing(null)
    setNotes("")
    fetchItems()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Advertiser Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString()} submissions</p>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Advertiser</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="sticky right-0 bg-background" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
              : items.length === 0
                ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No submissions yet.</TableCell></TableRow>
                : items.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-xs">
                    <p className="font-medium text-sm truncate">{s.task_title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.task_type} · {s.cost_type}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{s.company_name}</p>
                    <p className="text-xs text-muted-foreground">{s.contact_email}</p>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{formatCurrency(s.budget_kobo)}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatCurrency(s.proposed_reward_kobo)}</TableCell>
                  <TableCell>
                    <Badge variant={s.payment_status === "paid" ? "success" : s.payment_status === "waived" ? "outline" : "pending"} className="text-[10px] capitalize">
                      {s.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[s.status]} className="capitalize text-[10px]">{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                  <TableCell className="sticky right-0 bg-background shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.1)]">
                    <Button variant="outline" size="sm" onClick={() => setReviewing(s)}>Review</Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {total > limit && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">Page {page} of {Math.ceil(total / limit)}</span>
          <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {reviewing && (
        <Dialog open onOpenChange={() => { setReviewing(null); setNotes("") }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{reviewing.task_title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{reviewing.description}</p>
              {reviewing.instructions && (
                <div>
                  <p className="font-medium text-xs uppercase text-muted-foreground mt-2">Instructions</p>
                  <p>{reviewing.instructions}</p>
                </div>
              )}
              {reviewing.proof_requirements && (
                <div>
                  <p className="font-medium text-xs uppercase text-muted-foreground mt-2">Proof Requirements</p>
                  <p>{reviewing.proof_requirements}</p>
                </div>
              )}
              {reviewing.verification_url && (
                <a href={reviewing.verification_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary text-xs underline">
                  Destination link <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div><p className="text-xs text-muted-foreground">Company</p><p className="font-medium">{reviewing.company_name}</p></div>
                <div><p className="text-xs text-muted-foreground">Contact</p><p className="font-medium">{reviewing.contact_email}</p></div>
                <div><p className="text-xs text-muted-foreground">Budget</p><p className="font-medium">{formatCurrency(reviewing.budget_kobo)}</p></div>
                <div><p className="text-xs text-muted-foreground">Reward / completion</p><p className="font-medium">{formatCurrency(reviewing.proposed_reward_kobo)}</p></div>
                <div><p className="text-xs text-muted-foreground">Desired completions</p><p className="font-medium">{reviewing.desired_completions ?? "Uncapped"}</p></div>
                <div><p className="text-xs text-muted-foreground">Cost type</p><p className="font-medium capitalize">{reviewing.cost_type}</p></div>
              </div>

              {reviewing.status === "pending" ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Admin notes (optional)</p>
                    <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes, or reason for rejection" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" disabled={saving} onClick={() => review("reject")}>
                      <X className="w-4 h-4" /> Reject
                    </Button>
                    <Button variant="gradient" className="flex-1" disabled={saving} onClick={() => review("approve")}>
                      <Check className="w-4 h-4" /> Approve &amp; create draft task
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Already {reviewing.status}{reviewing.admin_notes ? ` — ${reviewing.admin_notes}` : ""}.
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
