"use client"
import { useState, useEffect, useCallback } from "react"
import { ShieldAlert, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/lib/utils"

interface FraudFlag {
  id: string; reason: string; severity: "low" | "medium" | "high" | "critical"
  details: Record<string, unknown> | null; resolved: boolean
  created_at: string; resolved_at: string | null
  user: { id: string; full_name: string; email: string }
}

const severityConfig = {
  low:      { variant: "outline"     as const, label: "Low"      },
  medium:   { variant: "pending"     as const, label: "Medium"   },
  high:     { variant: "warning"     as const, label: "High"     },
  critical: { variant: "destructive" as const, label: "Critical" },
}

export default function AdminFraudPage() {
  const [flags, setFlags]         = useState<FraudFlag[]>([])
  const [loading, setLoading]     = useState(true)
  const [severity, setSeverity]   = useState("")
  const [page, setPage]           = useState(1)
  const [total, setTotal]         = useState(0)
  const [resolving, setResolving] = useState<string | null>(null)
  const limit = 20

  const fetchFlags = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (severity && severity !== "all") params.set("severity", severity)
    const res  = await fetch(`/api/admin/fraud?${params}`)
    const json = await res.json()
    setFlags(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, severity])

  useEffect(() => { fetchFlags() }, [fetchFlags])

  async function handleResolve(id: string) {
    setResolving(id)
    const res  = await fetch("/api/admin/fraud", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setResolving(null); return }
    toast.success("Flag resolved")
    setFlags(prev => prev.filter(f => f.id !== id))
    setTotal(t => t - 1)
    setResolving(null)
  }

  const criticalCount = flags.filter(f => f.severity === "critical").length
  const highCount     = flags.filter(f => f.severity === "high").length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Fraud Flags</h1>
        <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString()} open flags</p>
      </div>

      {/* Summary cards */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {criticalCount > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Critical</p>
                  <p className="text-xl font-bold text-destructive">{criticalCount}</p>
                </div>
              </CardContent>
            </Card>
          )}
          {highCount > 0 && (
            <Card className="border-amber-300/50 bg-amber-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">High</p>
                  <p className="text-xl font-bold text-amber-600">{highCount}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={severity} onValueChange={v => { setSeverity(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All severities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Flagged At</TableHead>
              <TableHead>Details</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                ))
              : flags.length === 0
              ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                  No open fraud flags
                </TableCell></TableRow>
              : flags.map(f => {
                  const cfg = severityConfig[f.severity] ?? severityConfig.medium
                  return (
                    <TableRow key={f.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{f.user.full_name}</p>
                        <p className="text-xs text-muted-foreground">{f.user.email}</p>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">{f.reason}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="capitalize text-[10px]">{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(f.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {f.details ? JSON.stringify(f.details) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => handleResolve(f.id)} disabled={resolving === f.id}>
                          {resolving === f.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                          Resolve
                        </Button>
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
    </div>
  )
}
