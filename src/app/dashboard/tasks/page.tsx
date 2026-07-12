"use client"
import { useState, useEffect, useCallback } from "react"
import { Search, Filter, Zap, Clock, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskCard } from "@/components/tasks/TaskCard"
import { TaskCompletionModal } from "@/components/tasks/TaskCompletionModal"
import { AdSlot } from "@/components/ads/AdSlot"
import type { Task, TaskCategory } from "@/types"

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [type, setType] = useState("")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: page.toString(), limit: "20" })
    if (search) params.set("search", search)
    if (category) params.set("category", category)
    if (type) params.set("type", type)

    const res = await fetch(`/api/tasks?${params}`)
    const json = await res.json()
    setTasks(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, search, category, type])

  useEffect(() => {
    fetch("/api/tasks?limit=100")
      .then(r => r.json())
      .then(json => {
        const cats = Array.from(new Map((json.data ?? []).map((t: Task) => [t.category_id, t.category])).values()).filter(Boolean)
        setCategories(cats as TaskCategory[])
      })
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function handleComplete(taskId: string, proof?: { url?: string; text?: string }) {
    const fp = await getFingerprint()
    const res = await fetch(`/api/tasks/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof_url: proof?.url, proof_text: proof?.text, device_fingerprint: fp }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return false }
    toast.success(json.data.status === "approved" ? "Task completed! Credits added." : "Submission received! Pending review.")
    fetchTasks()
    return true
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Available Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} tasks available</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." className="pl-9" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select value={category} onValueChange={v => { setCategory(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={v => { setType(v === "all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="unverified">Instant Pay</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-primary" /> Instant Pay — credited immediately</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-500" /> Verified — requires admin review</span>
      </div>

      <AdSlot placement="tasklist" />

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Filter className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No tasks found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClaim={() => setSelectedTask(task)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {selectedTask && (
        <TaskCompletionModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSubmit={proof => handleComplete(selectedTask.id, proof)}
        />
      )}
    </div>
  )
}

async function getFingerprint(): Promise<string> {
  const nav = window.navigator
  const str = [nav.userAgent, nav.language, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone].join("|")
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32)
}
