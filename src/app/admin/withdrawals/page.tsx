"use client"
import { useState, useEffect, useCallback } from "react"
import { CheckCircle2, XCircle, Clock, Loader2, Banknote } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDateTime } from "@/lib/utils"

interface Withdrawal {
  id: string; amount: number; status: string; created_at: string
  admin_notes: string | null; rejection_reason: string | null
  user: { id: string; full_name: string; email: string }
  account: { bank_name: string; account_number: string; account_name: string }
}

const statusConfig: Record<string, { label: string; variant: "success" | "pending" | "destructive" | "outline" }> = {
  pending:      { label: "Pending",      variant: "pending"     },
  under_review: { label: "Under Review", variant: "pending"     },
  approved:     { label: "Approved",     variant: "success"     },
  paid:         { label: "Paid",         variant: "success"     },
  rejected:     { label: "Rejected",     variant: "destructive" },
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [page, setPage]               = useState(1)
  const [total, setTotal]             = useState(0)
  const [acting, setActing]           = useState<{ w: Withdrawal; action: "approve" | "reject" | "paid" } | null>(null)
  const [notes, setNotes]             = useState("")
  const [processing, setProcessing]   = useState(false)
  const limit = 20

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter)
    const res  = await fetch(`/api/admin/withdrawals?${params}`)
    const json = await res.json()
    setWithdrawals(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { fetchWithdrawals() }, [fetchWithdrawals])

  async function handleAction() {
    if (!acting) return
    setProcessing(true)
    const res = await fetch("/api/admin/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: acting.w.id, status: acting.action === "paid" ? "paid" : acting.action === "approve" ? "approved" : "rejected",
        reason: acting.action === "reject" ? notes : undefined,
        admin_notes: notes || undefined,
      }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setProcessing(false); return }
    toast.success(`Withdrawal ${acting.action}d`)
    setActing(null); setNotes("")
    fetchWithdrawals()
    setProcessing(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Withdrawals</h1>
          <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString()} withdrawal requests</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Bank Account</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
              : withdrawals.length === 0
              ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No withdrawals found</TableCell></TableRow>
              : withdrawals.map(w => {
                const cfg = statusConfig[w.status] ?? statusConfig.pending
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{w.user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{w.user.email}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{w.account.bank_name}</p>
                      <p className="text-xs text-muted-foreground">{w.account.account_name} · ****{w.account.account_number.slice(-4)}</p>
                    </TableCell>
                    <TableCell className="font-bold tabular-nums">{formatCurrency(w.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(w.created_at)}</TableCell>
                    <TableCell>
                      {["pending", "under_review"].includes(w.status) && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-emerald-600 hover:bg-emerald-50 text-xs"
                            onClick={() => { setActing({ w, action: "approve" }); setNotes("") }}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-destructive hover:bg-destructive/10 text-xs"
                            onClick={() => { setActing({ w, action: "reject" }); setNotes("") }}>
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                      {w.status === "approved" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => { setActing({ w, action: "paid" }); setNotes("") }}>
                          <Banknote className="w-3.5 h-3.5 mr-1" />Mark paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
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

      {/* Action modal */}
      {acting && (
        <Dialog open onOpenChange={() => { setActing(null); setNotes("") }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {acting.action === "approve" ? "Approve" : acting.action === "reject" ? "Reject" : "Mark as Paid"} Withdrawal
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted text-sm">
                <p className="font-medium">{acting.w.user.full_name}</p>
                <p className="text-muted-foreground">{acting.w.account.bank_name} · {acting.w.account.account_name}</p>
                <p className="font-bold text-lg mt-1">{formatCurrency(acting.w.amount)}</p>
              </div>
              <div>
                <Label>{acting.action === "reject" ? "Reason for rejection" : "Admin notes (optional)"}</Label>
                <Textarea className="mt-1" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder={acting.action === "reject" ? "Explain why the request is rejected…" : "Internal notes…"} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setActing(null); setNotes("") }}>Cancel</Button>
                <Button
                  variant={acting.action === "reject" ? "destructive" : "gradient"}
                  className="flex-1" disabled={processing} onClick={handleAction}
                >
                  {processing && <Loader2 className="animate-spin" />}
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
