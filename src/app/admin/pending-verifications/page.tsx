"use client"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PendingRecord = {
  id: string
  full_name: string
  email: string
  payment_reference: string
  payment_method: string
  status: "pending" | "approved" | "rejected"
  notes: string | null
  created_at: string
  reviewed_at: string | null
}

type FilterStatus = "pending" | "approved" | "rejected"

export default function PendingVerificationsPage() {
  const [records, setRecords] = useState<PendingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>("pending")
  const [selected, setSelected] = useState<PendingRecord | null>(null)
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [notes, setNotes] = useState("")
  const [acting, setActing] = useState(false)

  async function fetchRecords(status: FilterStatus) {
    setLoading(true)
    const res = await fetch(`/api/admin/pending-verifications?status=${status}`)
    const json = await res.json()
    setRecords(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchRecords(filter) }, [filter])

  async function handleAction() {
    if (!selected || !action) return
    setActing(true)
    const res = await fetch("/api/admin/pending-verifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, action, notes }),
    })
    const json = await res.json()
    if (json.error) {
      toast.error(json.error)
    } else {
      toast.success(action === "approve" ? "Account created — password reset email sent" : "Request rejected")
      setSelected(null)
      setAction(null)
      setNotes("")
      fetchRecords(filter)
    }
    setActing(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pending Verifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bank transfer registration requests awaiting manual review.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchRecords(filter)}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["pending", "approved", "rejected"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
              filter === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No {filter} requests</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                {filter === "pending" && (
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.payment_reference}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-NG")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        r.status === "approved"
                          ? "default"
                          : r.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  {filter === "pending" && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10 h-7 text-xs"
                          onClick={() => { setSelected(r); setAction("reject") }}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => { setSelected(r); setAction("approve") }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setAction(null); setNotes("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approve Registration" : "Reject Registration"}
            </DialogTitle>
            <DialogDescription>
              {action === "approve"
                ? `Create an account for ${selected?.email}. A password-reset email will be sent automatically.`
                : `Reject the registration request from ${selected?.email}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              placeholder={action === "approve" ? "Internal note..." : "Reason for rejection..."}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setAction(null); setNotes("") }}>
              Cancel
            </Button>
            <Button
              variant={action === "reject" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={acting}
            >
              {acting && <Loader2 className="animate-spin" />}
              {action === "approve" ? "Approve & Create Account" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
