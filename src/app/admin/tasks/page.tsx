"use client"
import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Archive } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Task } from "@/types"

const statusVariant: Record<string, "success" | "pending" | "destructive" | "outline"> = {
  active: "success", draft: "pending", completed: "outline", archived: "destructive",
}

function margin(t: Task) {
  if (t.advertiser_cost_kobo == null) return null
  return t.advertiser_cost_kobo - t.reward_amount
}

export default function AdminTasksPage() {
  const [tasks, setTasks]       = useState<Task[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setStatusFilter] = useState("active")
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const [editing, setEditing]   = useState<Partial<Task> | null>(null)
  const [saving, setSaving]     = useState(false)
  const limit = 20

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter)
    const res  = await fetch(`/api/admin/tasks?${params}`)
    const json = await res.json()
    setTasks(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => {
    fetch("/api/admin/tasks?limit=1")
      .then(r => r.json())
      .then(() => {
        fetch("/api/tasks?limit=1")
          .then(r => r.json())
          .then(j => {
            const cats = Array.from(new Map((j.data ?? []).map((t: Task) => [t.category_id, t.category])).values()).filter(Boolean)
            setCategories(cats as { id: string; name: string }[])
          })
      })
  }, [])

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    const isNew = !editing.id
    const url   = isNew ? "/api/admin/tasks" : `/api/admin/tasks/${editing.id}`
    const method = isNew ? "POST" : "PATCH"
    const res   = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) })
    const json  = await res.json()
    if (!res.ok) { toast.error(json.error); setSaving(false); return }
    toast.success(isNew ? "Task created!" : "Task updated!")
    setEditing(null)
    fetchTasks()
    setSaving(false)
  }

  async function handleArchive(id: string) {
    const res = await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    })
    if (!res.ok) { toast.error("Failed to archive task"); return }
    toast.success("Task archived")
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString()} tasks</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => setEditing({ status: "draft", type: "unverified", reward_amount: 0, requires_proof: false })}>
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Margin</TableHead>
              <TableHead>Completions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
              : tasks.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-xs">
                    <p className="font-medium text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{(t as Task & { category?: { name: string } }).category?.name}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.type === "unverified" ? "success" : "pending"} className="text-[10px]">
                      {t.type === "unverified" ? "Instant" : "Verified"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">{formatCurrency(t.reward_amount)}</TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {margin(t) === null
                      ? <span className="text-muted-foreground">—</span>
                      : <span className={margin(t)! >= 0 ? "text-emerald-600" : "text-destructive"}>
                          {margin(t)! >= 0 ? "+" : ""}{formatCurrency(margin(t)!)}
                        </span>}
                    {t.task_source === "advertiser" && (
                      <p className="text-[10px] text-muted-foreground capitalize">{t.cost_type} · advertiser</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {t.current_completions.toLocaleString()}
                    {t.max_completions !== null && <span className="text-muted-foreground">/{t.max_completions.toLocaleString()}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[t.status] ?? "outline"} className="capitalize text-[10px]">{t.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {t.status !== "archived" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleArchive(t.id)}>
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
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

      {/* Task form modal */}
      {editing !== null && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Edit Task" : "Create New Task"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {[
                { id: "title",        label: "Title",        type: "input",  field: "title"       },
                { id: "description",  label: "Description",  type: "textarea", field: "description" },
                { id: "instructions", label: "Instructions", type: "textarea", field: "instructions" },
              ].map(({ id, label, type, field }) => (
                <div key={id}>
                  <Label htmlFor={id}>{label}</Label>
                  {type === "textarea"
                    ? <Textarea id={id} className="mt-1" value={(editing as Record<string, string>)[field] ?? ""}
                        onChange={e => setEditing(prev => ({ ...prev, [field]: e.target.value }))} rows={3} />
                    : <Input id={id} className="mt-1" value={(editing as Record<string, string>)[field] ?? ""}
                        onChange={e => setEditing(prev => ({ ...prev, [field]: e.target.value }))} />}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={editing.type ?? "unverified"}
                    onValueChange={v => setEditing(prev => ({ ...prev, type: v as "verified" | "unverified" }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unverified">Instant Pay</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status ?? "draft"}
                    onValueChange={v => setEditing(prev => ({ ...prev, status: v as Task["status"] }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reward">Reward (kobo)</Label>
                  <Input id="reward" type="number" className="mt-1"
                    value={editing.reward_amount ?? 0}
                    onChange={e => setEditing(prev => ({ ...prev, reward_amount: parseInt(e.target.value) || 0 }))} />
                  <p className="text-xs text-muted-foreground mt-1">{formatCurrency(editing.reward_amount ?? 0)}</p>
                </div>
                <div>
                  <Label htmlFor="maxComp">Max Completions</Label>
                  <Input id="maxComp" type="number" className="mt-1" placeholder="Unlimited"
                    value={editing.max_completions ?? ""}
                    onChange={e => setEditing(prev => ({ ...prev, max_completions: e.target.value ? parseInt(e.target.value) : null }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cost Type</Label>
                  <Select value={editing.cost_type ?? "flat"}
                    onValueChange={v => setEditing(prev => ({ ...prev, cost_type: v as "flat" | "cpa" }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat (advertiser pre-paid budget)</SelectItem>
                      <SelectItem value="cpa">CPA (paid per completion)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Affects the margin calculation only — doesn't change payouts.</p>
                </div>
                <div>
                  <Label htmlFor="advCost">Advertiser Cost (kobo)</Label>
                  <Input id="advCost" type="number" className="mt-1" placeholder="No external revenue"
                    value={editing.advertiser_cost_kobo ?? ""}
                    onChange={e => setEditing(prev => ({ ...prev, advertiser_cost_kobo: e.target.value ? parseInt(e.target.value) : null }))} />
                  <p className="text-xs text-muted-foreground mt-1">What you're paid per completion. Leave blank for ordinary internal tasks.</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="gradient" className="flex-1" disabled={saving} onClick={handleSave}>
                  {editing.id ? "Save changes" : "Create task"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
