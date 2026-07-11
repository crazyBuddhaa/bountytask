"use client"
import { useState, useEffect, useCallback } from "react"
import { CheckCircle2, XCircle, ExternalLink, ImageIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { formatCurrency, formatDateTime } from "@/lib/utils"

interface Completion {
  id: string; status: string; proof_url: string | null; proof_text: string | null
  submitted_at: string
  task: { id: string; title: string; reward_amount: number; type: string }
  user: { id: string; full_name: string; email: string; username: string | null }
}

export default function AdminApprovalsPage() {
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [rejecting, setRejecting]     = useState<string | null>(null)
  const [reason, setReason]           = useState("")
  const [processing, setProcessing]   = useState(false)
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const limit = 20

  const fetchPending = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/admin/approvals?page=${page}&limit=${limit}`)
    const json = await res.json()
    setCompletions(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page])

  useEffect(() => { fetchPending() }, [fetchPending])

  function toggleSelect(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function selectAll() { setSelected(new Set(completions.map(c => c.id))) }
  function clearAll()  { setSelected(new Set()) }

  async function handleBulk(action: "approve" | "reject", ids: string[], rejectionReason?: string) {
    setProcessing(true)
    const res = await fetch("/api/admin/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action, reason: rejectionReason }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setProcessing(false); return }
    toast.success(`${json.data.processed} completion(s) ${action}d`)
    setSelected(new Set())
    setRejecting(null)
    setReason("")
    fetchPending()
    setProcessing(false)
  }

  const selectedArr = Array.from(selected)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approvals Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString()} pending submissions</p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
              onClick={() => handleBulk("approve", selectedArr)} disabled={processing}>
              {processing ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve all
            </Button>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setRejecting("bulk")} disabled={processing}>
              <XCircle className="w-4 h-4" /> Reject all
            </Button>
          </div>
        )}
      </div>

      {/* Select controls */}
      <div className="flex gap-2 text-sm">
        <button onClick={selectAll} className="text-primary hover:underline">Select all on page</button>
        <span className="text-muted-foreground">·</span>
        <button onClick={clearAll} className="text-muted-foreground hover:underline">Clear</button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Task</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Proof</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
              : completions.length === 0
              ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No pending submissions 🎉
                </TableCell></TableRow>
              )
              : completions.map(c => (
                <TableRow key={c.id} className={selected.has(c.id) ? "bg-primary/5" : ""}>
                  <TableCell>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                      className="rounded border-border" />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm max-w-48 truncate">{c.task.title}</p>
                    <Badge variant={c.task.type === "unverified" ? "success" : "pending"} className="text-[10px] mt-0.5">
                      {c.task.type === "unverified" ? "Instant" : "Verified"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{c.user.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.user.email}</p>
                  </TableCell>
                  <TableCell className="font-bold text-emerald-600">{formatCurrency(c.task.reward_amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(c.submitted_at)}</TableCell>
                  <TableCell>
                    {c.proof_url
                      ? <a href={c.proof_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ImageIcon className="w-3 h-3" />View
                        </a>
                      : c.proof_text
                      ? <span className="text-xs text-muted-foreground line-clamp-1 max-w-32" title={c.proof_text}>{c.proof_text}</span>
                      : <span className="text-xs text-muted-foreground">None</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={() => handleBulk("approve", [c.id])} disabled={processing}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-destructive hover:bg-destructive/10"
                        onClick={() => setRejecting(c.id)} disabled={processing}>
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    </div>
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

      {/* Rejection reason modal */}
      {rejecting && (
        <Dialog open onOpenChange={() => { setRejecting(null); setReason("") }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Reject Submission</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Reason for rejection</Label>
                <Textarea className="mt-1" placeholder="e.g. Proof does not match task requirements"
                  value={reason} onChange={e => setReason(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setRejecting(null); setReason("") }}>Cancel</Button>
                <Button variant="destructive" className="flex-1" disabled={processing}
                  onClick={() => handleBulk("reject", rejecting === "bulk" ? selectedArr : [rejecting], reason)}>
                  {processing && <Loader2 className="animate-spin" />}
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
