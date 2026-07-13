"use client"
import { useState, useEffect, useCallback } from "react"
import { ArrowUpCircle, ArrowDownCircle, Wallet, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import type { LedgerEntry } from "@/types"
import { AdSlot } from "@/components/ads/AdSlot"

const refTypeLabels: Record<string, string> = {
  task_reward:         "Task Reward",
  referral_bonus:      "Referral Bonus",
  signup_bonus:        "Signup Bonus",
  withdrawal_debit:    "Withdrawal",
  withdrawal_reversal: "Withdrawal Reversed",
  manual_credit:       "Manual Credit",
  manual_debit:        "Manual Debit",
}

export default function EarningsPage() {
  const [balance, setBalance]       = useState<number | null>(null)
  const [entries, setEntries]       = useState<LedgerEntry[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage]             = useState(1)
  const [total, setTotal]           = useState(0)
  const limit = 20

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    const res  = await fetch(`/api/ledger?page=${page}&limit=${limit}`)
    const json = await res.json()
    if (json.data) {
      setBalance(json.data.balance)
      setEntries(json.data.entries ?? [])
      setTotal(json.data.total ?? 0)
    }
    setLoading(false)
    setRefreshing(false)
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  const totalCredits = entries.filter(e => e.type === "credit").reduce((s, e) => s + e.delta, 0)
  const totalDebits  = entries.filter(e => e.type === "debit").reduce((s, e) => s + Math.abs(e.delta), 0)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Earnings & Ledger</h1>
          <p className="text-muted-foreground text-sm mt-1">Every credit and debit — append-only, tamper-proof.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Available Balance</p>
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            {loading ? <Skeleton className="h-8 w-32" /> : (
              <p className="text-3xl font-bold text-primary">{formatCurrency(balance ?? 0)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Total Earned (this page)</p>
              <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
            </div>
            {loading ? <Skeleton className="h-8 w-28" /> : (
              <p className="text-2xl font-bold text-emerald-600">+{formatCurrency(totalCredits)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground font-medium">Total Withdrawn (this page)</p>
              <ArrowDownCircle className="w-5 h-5 text-red-500" />
            </div>
            {loading ? <Skeleton className="h-8 w-28" /> : (
              <p className="text-2xl font-bold text-red-600">-{formatCurrency(totalDebits)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AdSlot placement="earnings" />

      {/* Ledger table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No transactions yet. Complete a task to start earning!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant={entry.type === "credit" ? "success" : "destructive"} className="text-[10px]">
                        {entry.type === "credit"
                          ? <ArrowUpCircle className="w-2.5 h-2.5" />
                          : <ArrowDownCircle className="w-2.5 h-2.5" />}
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">
                      <span className="text-xs text-muted-foreground mr-2">
                        {refTypeLabels[entry.ref_type] ?? entry.ref_type}
                      </span>
                      {entry.note && <span className="text-muted-foreground">— {entry.note}</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(entry.created_at)}
                    </TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${entry.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                      {entry.type === "credit" ? "+" : "-"}{formatCurrency(Math.abs(entry.delta))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">
            Page {page} of {Math.ceil(total / limit)} ({total.toLocaleString()} entries)
          </span>
          <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
