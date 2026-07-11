"use client"
import { useState, useEffect, useCallback } from "react"
import { Search, BookOpen } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDateTime } from "@/lib/utils"

interface LedgerEntry {
  id: string; user_id: string; type: "credit" | "debit"; delta: number
  ref_type: string; ref_id: string | null; note: string | null; created_at: string
  user: { id: string; full_name: string; email: string } | null
}

const refTypeLabels: Record<string, string> = {
  task_reward:         "Task Reward",
  referral_bonus:      "Referral Bonus",
  signup_bonus:        "Signup Bonus",
  withdrawal_debit:    "Withdrawal",
  withdrawal_reversal: "Withdrawal Reversal",
  manual_credit:       "Manual Credit",
  manual_debit:        "Manual Debit",
}

export default function AdminLedgerPage() {
  const [entries, setEntries]   = useState<LedgerEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState("")
  const [refType, setRefType]   = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo]     = useState("")
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const limit = 50

  const fetchLedger = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (userId)   params.set("user_id",   userId)
    if (refType && refType !== "all") params.set("ref_type", refType)
    if (dateFrom) params.set("date_from", dateFrom)
    if (dateTo)   params.set("date_to",   dateTo)

    const res  = await fetch(`/api/admin/ledger?${params}`)
    const json = await res.json()
    setEntries(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, userId, refType, dateFrom, dateTo])

  useEffect(() => {
    const t = setTimeout(fetchLedger, 300)
    return () => clearTimeout(t)
  }, [fetchLedger])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Ledger Explorer</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Full append-only ledger across all users. {total.toLocaleString()} entries.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filter by user ID…" className="pl-9"
            value={userId} onChange={e => { setUserId(e.target.value.trim()); setPage(1) }} />
        </div>
        <Select value={refType} onValueChange={v => { setRefType(v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All transaction types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(refTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
        <Input type="date" className="w-40" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPage(1) }} />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              : entries.length === 0
              ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No ledger entries match the current filters.
                </TableCell></TableRow>
              : entries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{e.user?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{e.user?.email ?? e.user_id.slice(0, 8) + "…"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.type === "credit" ? "success" : "destructive"} className="text-[10px] capitalize">
                        {e.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {refTypeLabels[e.ref_type] ?? e.ref_type}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{e.note ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${e.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                      {e.type === "credit" ? "+" : "−"}{formatCurrency(Math.abs(e.delta))}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {total > limit && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">
            Page {page} of {Math.ceil(total / limit)} ({total.toLocaleString()} total)
          </span>
          <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
