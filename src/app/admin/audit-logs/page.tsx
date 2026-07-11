"use client"
import { useState, useEffect, useCallback } from "react"
import { Search, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/lib/utils"

interface AuditLog {
  id: string; action: string; target_type: string | null; target_id: string | null
  details: Record<string, unknown> | null; ip_address: string | null; created_at: string
  actor: { id: string; full_name: string; email: string } | null
}

const actionColor = (action: string) => {
  if (action.includes("create") || action.includes("approve") || action.includes("credit")) return "success"
  if (action.includes("delete") || action.includes("reject") || action.includes("deactivat")) return "destructive"
  if (action.includes("flag") || action.includes("fraud")) return "warning"
  return "outline"
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs]       = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState("")
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)
  const limit = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set("action", search)
    const res  = await fetch(`/api/admin/audit-logs?${params}`)
    const json = await res.json()
    setLogs(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, search])

  useEffect(() => {
    const t = setTimeout(fetchLogs, 300)
    return () => clearTimeout(t)
  }, [fetchLogs])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Immutable, append-only record of all admin and system actions. {total.toLocaleString()} entries.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Filter by action…" className="pl-9"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              : logs.length === 0
              ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No audit log entries found
                </TableCell></TableRow>
              : logs.map(log => (
                  <TableRow key={log.id} className="font-mono text-xs">
                    <TableCell>
                      <Badge variant={actionColor(log.action) as "success" | "destructive" | "warning" | "outline"}
                        className="text-[10px] font-mono font-normal">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.actor
                        ? <span className="font-sans">{log.actor.full_name}</span>
                        : <span className="text-muted-foreground font-sans">system</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.target_type && <span>{log.target_type}</span>}
                      {log.target_id && <span className="ml-1 opacity-60">{log.target_id.slice(0, 8)}…</span>}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.ip_address ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap font-sans">
                      {formatDateTime(log.created_at)}
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
    </div>
  )
}
