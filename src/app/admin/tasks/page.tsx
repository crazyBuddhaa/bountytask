"use client"
import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Archive, Youtube, Share2 } from "lucide-react"
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
import type { Task, SocialPlatform, SocialAction } from "@/types"

// ─── Constants ────────────────────────────────────────────────────────────────

const statusVariant: Record<string, "success" | "pending" | "destructive" | "outline"> = {
  active: "success", draft: "pending", completed: "outline", archived: "destructive",
}

const SOCIAL_PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: "twitter_x",  label: "Twitter/X"  },
  { value: "instagram",  label: "Instagram"   },
  { value: "tiktok",     label: "TikTok"      },
  { value: "youtube",    label: "YouTube"      },
  { value: "facebook",   label: "Facebook"     },
  { value: "threads",    label: "Threads"      },
]

const PLATFORM_ACTIONS: Record<SocialPlatform, { value: SocialAction; label: string }[]> = {
  twitter_x: [
    { value: "follow",  label: "Follow"  },
    { value: "like",    label: "Like"    },
    { value: "repost",  label: "Repost"  },
    { value: "comment", label: "Comment" },
  ],
  instagram: [
    { value: "follow",  label: "Follow"  },
    { value: "like",    label: "Like"    },
    { value: "comment", label: "Comment" },
  ],
  tiktok: [
    { value: "follow",  label: "Follow"  },
    { value: "like",    label: "Like"    },
    { value: "comment", label: "Comment" },
  ],
  youtube: [
    { value: "subscribe", label: "Subscribe" },
    { value: "like",      label: "Like"      },
    { value: "comment",   label: "Comment"   },
  ],
  facebook: [
    { value: "follow",  label: "Follow"  },
    { value: "like",    label: "Like"    },
    { value: "comment", label: "Comment" },
  ],
  threads: [
    { value: "follow",  label: "Follow"  },
    { value: "like",    label: "Like"    },
    { value: "repost",  label: "Repost"  },
    { value: "comment", label: "Comment" },
  ],
}

// Actions that require a specific post/video URL (not just a handle)
const ACTION_NEEDS_POST_URL = new Set<SocialAction>(["like", "comment", "repost"])

const ACTION_LABELS: Record<string, string> = {
  follow: "Follow", like: "Like", comment: "Comment",
  repost: "Repost", subscribe: "Subscribe",
}

const EDITABLE_TASK_FIELDS = [
  "title", "description", "instructions", "category_id", "type", "status",
  "reward_amount", "max_completions", "max_completions_per_user", "requires_proof", "proof_instructions",
  "time_limit_hours", "verification_url", "expires_at", "cost_type", "advertiser_cost_kobo",
  "youtube_url", "min_watch_seconds",
  // Social media task fields
  "social_platform", "social_action", "social_target_handle", "social_target_post_url",
  "social_required_comment_text", "ai_verify_screenshot",
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function margin(t: Task) {
  if (t.advertiser_cost_kobo == null) return null
  return t.advertiser_cost_kobo - t.reward_amount
}

function isYouTubeUrl(url: string) {
  return /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/.test(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminTasksPage() {
  const [tasks, setTasks]           = useState<Task[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatusFilter] = useState("active")
  const [page, setPage]             = useState(1)
  const [total, setTotal]           = useState(0)
  const [editing, setEditing]       = useState<Partial<Task> | null>(null)
  const [saving, setSaving]         = useState(false)
  const limit = 20

  // Derived: what format is the task being edited?
  const isVideo  = editing != null && editing.youtube_url !== null && editing.youtube_url !== undefined
  const isSocial = editing != null && editing.social_platform != null
  const taskFormat: "standard" | "video" | "social" =
    isSocial ? "social" : isVideo ? "video" : "standard"

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
    fetch("/api/tasks?limit=100")
      .then(r => r.json())
      .then(j => {
        const cats = Array.from(
          new Map((j.data ?? []).map((t: Task) => [t.category_id, t.category])).values()
        ).filter(Boolean)
        setCategories(cats as { id: string; name: string }[])
      })
  }, [])

  function toTaskPayload(t: Partial<Task>) {
    const payload: Record<string, unknown> = {}
    for (const key of EDITABLE_TASK_FIELDS) {
      if (key in t) payload[key] = (t as Record<string, unknown>)[key]
    }
    return payload
  }

  async function handleSave() {
    if (!editing) return

    if (editing.youtube_url && !isYouTubeUrl(editing.youtube_url)) {
      toast.error("Please enter a valid YouTube URL (youtube.com/watch?v=... or youtu.be/...)")
      return
    }
    if (isSocial && !editing.social_target_handle?.trim()) {
      toast.error("Target handle is required for social media tasks.")
      return
    }
    if (isSocial && ACTION_NEEDS_POST_URL.has(editing.social_action as SocialAction) && !editing.social_target_post_url?.trim()) {
      toast.error("Post / video URL is required for this action.")
      return
    }

    setSaving(true)
    const isNew = !editing.id
    const url    = isNew ? "/api/admin/tasks" : `/api/admin/tasks/${editing.id}`
    const method = isNew ? "POST" : "PATCH"
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(toTaskPayload(editing)) })
    const json   = await res.json()
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

  function openNew() {
    setEditing({
      status: "draft", type: "unverified", reward_amount: 0,
      requires_proof: false, max_completions_per_user: 1,
      youtube_url: null, min_watch_seconds: null,
      social_platform: null, social_action: null, social_target_handle: null,
      social_target_post_url: null, social_required_comment_text: null,
      ai_verify_screenshot: false,
    })
  }

  /** Switch between Standard / YouTube / Social formats */
  function setFormat(fmt: "standard" | "video" | "social") {
    if (fmt === "standard") {
      setEditing(prev => ({
        ...prev,
        youtube_url: null, min_watch_seconds: null,
        social_platform: null, social_action: null, social_target_handle: null,
        social_target_post_url: null, social_required_comment_text: null, ai_verify_screenshot: false,
      }))
    } else if (fmt === "video") {
      setEditing(prev => ({
        ...prev,
        youtube_url: "", type: "unverified", requires_proof: false, max_completions_per_user: 1,
        social_platform: null, social_action: null, social_target_handle: null,
        social_target_post_url: null, social_required_comment_text: null, ai_verify_screenshot: false,
      }))
    } else { // social
      setEditing(prev => ({
        ...prev,
        youtube_url: null, min_watch_seconds: null,
        social_platform: "twitter_x", social_action: "follow",
        social_target_handle: "", social_target_post_url: null,
        social_required_comment_text: null, ai_verify_screenshot: false,
        type: "verified", requires_proof: true,
      }))
    }
  }

  /** When platform changes, reset action to the first valid option for that platform */
  function handlePlatformChange(platform: SocialPlatform) {
    const firstAction = PLATFORM_ACTIONS[platform]?.[0]?.value ?? "follow"
    setEditing(prev => ({
      ...prev,
      social_platform: platform,
      social_action: firstAction,
      // Clear post URL — it may not apply to the new action
      social_target_post_url: null,
    }))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString()} tasks</p>
        </div>
        <Button variant="gradient" size="sm" onClick={openNew}>
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

      {/* ── Task table ── */}
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
              <TableHead className="sticky right-0 bg-background" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : tasks.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-xs">
                      <div className="flex items-center gap-1.5">
                        {t.social_platform && <Share2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                        {!t.social_platform && t.youtube_url && <Youtube className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        <p className="font-medium text-sm truncate">{t.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(t as Task & { category?: { name: string } }).category?.name}
                        {t.social_platform && (
                          <span className="ml-1 text-indigo-400">
                            · {SOCIAL_PLATFORMS.find(p => p.value === t.social_platform)?.label}
                          </span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell>
                      {t.social_platform ? (
                        <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-200 bg-indigo-50">
                          {ACTION_LABELS[t.social_action ?? ""] ?? t.social_action}
                        </Badge>
                      ) : t.youtube_url ? (
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-200">Video</Badge>
                      ) : (
                        <Badge variant={t.type === "unverified" ? "success" : "pending"} className="text-[10px]">
                          {t.type === "unverified" ? "Instant" : "Verified"}
                        </Badge>
                      )}
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
                      {t.max_completions !== null && (
                        <span className="text-muted-foreground">/{t.max_completions.toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[t.status] ?? "outline"} className="capitalize text-[10px]">
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                    <TableCell className="sticky right-0 bg-background shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.1)]">
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
          <span className="flex items-center text-sm text-muted-foreground px-3">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* ── Task form modal ──────────────────────────────────────────────────── */}
      {editing !== null && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Edit Task" : "Create New Task"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">

              {/* Task format toggle — 3 options */}
              <div>
                <Label>Task Format</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {([
                    { fmt: "standard", label: "Standard",    icon: null },
                    { fmt: "video",    label: "YouTube video", icon: <Youtube className="w-3.5 h-3.5 text-red-500" /> },
                    { fmt: "social",   label: "Social media", icon: <Share2 className="w-3.5 h-3.5 text-indigo-500" /> },
                  ] as const).map(opt => (
                    <button
                      key={opt.fmt}
                      type="button"
                      onClick={() => setFormat(opt.fmt)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all ${
                        taskFormat === opt.fmt
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-input text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* YouTube settings panel */}
              {isVideo && (
                <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/40 p-3">
                  <div>
                    <Label htmlFor="youtubeUrl">YouTube URL <span className="text-destructive">*</span></Label>
                    <Input
                      id="youtubeUrl"
                      className="mt-1"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={editing.youtube_url ?? ""}
                      onChange={e => setEditing(prev => ({ ...prev, youtube_url: e.target.value || null }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Users will watch this embedded in the app.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="minWatch">Minimum watch time (seconds)</Label>
                    <Input
                      id="minWatch"
                      type="number"
                      min={30}
                      className="mt-1"
                      placeholder="e.g. 300 for a 5-min video"
                      value={editing.min_watch_seconds ?? ""}
                      onChange={e => setEditing(prev => ({ ...prev, min_watch_seconds: e.target.value ? parseInt(e.target.value) : null }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave blank to default to 30 s.
                    </p>
                  </div>
                </div>
              )}

              {/* Social media settings panel */}
              {isSocial && (
                <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
                  <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" /> Social Media Task
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Platform */}
                    <div>
                      <Label>Platform <span className="text-destructive">*</span></Label>
                      <Select
                        value={editing.social_platform ?? "twitter_x"}
                        onValueChange={v => handlePlatformChange(v as SocialPlatform)}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOCIAL_PLATFORMS.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Action */}
                    <div>
                      <Label>Action <span className="text-destructive">*</span></Label>
                      <Select
                        value={editing.social_action ?? "follow"}
                        onValueChange={v => setEditing(prev => ({
                          ...prev,
                          social_action: v as SocialAction,
                          // Clear post URL when switching to follow/subscribe
                          social_target_post_url: ACTION_NEEDS_POST_URL.has(v as SocialAction)
                            ? prev?.social_target_post_url ?? null
                            : null,
                        }))}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(PLATFORM_ACTIONS[editing.social_platform ?? "twitter_x"] ?? []).map(a => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Target handle */}
                  <div>
                    <Label htmlFor="socialHandle">
                      Target Handle <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="socialHandle"
                      className="mt-1"
                      placeholder="@username"
                      value={editing.social_target_handle ?? ""}
                      onChange={e => setEditing(prev => ({ ...prev, social_target_handle: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      The account users must interact with.
                    </p>
                  </div>

                  {/* Post / video URL — only for like, comment, repost */}
                  {ACTION_NEEDS_POST_URL.has(editing.social_action as SocialAction) && (
                    <div>
                      <Label htmlFor="socialPostUrl">
                        Post / Video URL <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="socialPostUrl"
                        className="mt-1"
                        placeholder="https://..."
                        value={editing.social_target_post_url ?? ""}
                        onChange={e => setEditing(prev => ({ ...prev, social_target_post_url: e.target.value || null }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Link to the specific post or video.
                      </p>
                    </div>
                  )}

                  {/* Required comment text — only for comment action */}
                  {editing.social_action === "comment" && (
                    <div>
                      <Label htmlFor="commentText">Required Comment Text</Label>
                      <Textarea
                        id="commentText"
                        className="mt-1"
                        rows={2}
                        placeholder="Type the exact text users must post as a comment…"
                        value={editing.social_required_comment_text ?? ""}
                        onChange={e => setEditing(prev => ({ ...prev, social_required_comment_text: e.target.value || null }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Leave blank to allow any comment. When filled, users must copy this exact text.
                      </p>
                    </div>
                  )}

                  {/* AI auto-verify toggle */}
                  <div className="flex items-center justify-between rounded-md border border-indigo-100 bg-white px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">AI auto-verify screenshots</p>
                      <p className="text-xs text-muted-foreground">
                        Gemini Vision checks each screenshot automatically. Approved submissions are credited instantly.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editing.ai_verify_screenshot ?? false}
                      onClick={() => setEditing(prev => ({ ...prev, ai_verify_screenshot: !prev?.ai_verify_screenshot }))}
                      className={`relative ml-4 h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                        editing.ai_verify_screenshot
                          ? "bg-indigo-600"
                          : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          editing.ai_verify_screenshot ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Core text fields */}
              {[
                { id: "title",        label: "Title",        type: "input",    field: "title"       },
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

              {/* Task link — hidden for video and social (they have their own URL fields) */}
              {!isVideo && !isSocial && (
                <div>
                  <Label htmlFor="verificationUrl">Task Link</Label>
                  <Input id="verificationUrl" className="mt-1" placeholder="https://..."
                    value={editing.verification_url ?? ""}
                    onChange={e => setEditing(prev => ({ ...prev, verification_url: e.target.value }))} />
                  <p className="text-xs text-muted-foreground mt-1">The URL users are sent to complete this task.</p>
                </div>
              )}

              {/* Proof & AI verification — standard verified tasks only */}
              {!isVideo && !isSocial && editing.type === "verified" && (
                <div className="space-y-3 rounded-lg border border-amber-100 bg-amber-50/30 p-3">
                  <p className="text-xs font-semibold text-amber-700">Proof & Verification</p>

                  {/* Requires proof toggle */}
                  <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Require proof of completion</p>
                      <p className="text-xs text-muted-foreground">
                        Users must upload a screenshot or describe how they completed the task.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editing.requires_proof ?? false}
                      onClick={() => setEditing(prev => ({
                        ...prev,
                        requires_proof: !prev?.requires_proof,
                        // turning off proof disables AI verify too
                        ai_verify_screenshot: !prev?.requires_proof ? prev?.ai_verify_screenshot : false,
                      }))}
                      className={`relative ml-4 h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                        editing.requires_proof ? "bg-amber-500" : "bg-gray-200"
                      }`}
                    >
                      <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        editing.requires_proof ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>

                  {/* Proof instructions — shown when requires_proof is on */}
                  {editing.requires_proof && (
                    <div>
                      <Label htmlFor="proofInstructions">Proof instructions (optional)</Label>
                      <Input
                        id="proofInstructions"
                        className="mt-1"
                        placeholder="e.g. Upload a screenshot showing your profile page"
                        value={(editing as Record<string, string>).proof_instructions ?? ""}
                        onChange={e => setEditing(prev => ({ ...prev, proof_instructions: e.target.value || null }))}
                      />
                    </div>
                  )}

                  {/* AI verify toggle — only when requires_proof */}
                  {editing.requires_proof && (
                    <div className="flex items-center justify-between rounded-md border border-amber-100 bg-white px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">AI auto-verify screenshots</p>
                        <p className="text-xs text-muted-foreground">
                          Gemini Vision checks each screenshot automatically. Approved submissions are credited instantly.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={editing.ai_verify_screenshot ?? false}
                        onClick={() => setEditing(prev => ({ ...prev, ai_verify_screenshot: !prev?.ai_verify_screenshot }))}
                        className={`relative ml-4 h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                          editing.ai_verify_screenshot ? "bg-indigo-600" : "bg-gray-200"
                        }`}
                      >
                        <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          editing.ai_verify_screenshot ? "translate-x-5" : "translate-x-0"
                        }`} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Type — locked for video and social tasks */}
                <div>
                  <Label>Type</Label>
                  {isVideo ? (
                    <div className="mt-1 flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                      Instant Pay (video)
                    </div>
                  ) : isSocial ? (
                    <div className="mt-1 flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                      {editing.ai_verify_screenshot ? "AI-Verified" : "Verified"}
                    </div>
                  ) : (
                    <Select value={editing.type ?? "unverified"}
                      onValueChange={v => setEditing(prev => ({ ...prev, type: v as "verified" | "unverified" }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unverified">Instant Pay</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="reward">Reward (kobo)</Label>
                  <Input id="reward" type="number" className="mt-1"
                    value={editing.reward_amount ?? 0}
                    onChange={e => setEditing(prev => ({ ...prev, reward_amount: parseInt(e.target.value) || 0 }))} />
                  <p className="text-xs text-muted-foreground mt-1">{formatCurrency(editing.reward_amount ?? 0)}</p>
                </div>
                <div>
                  <Label htmlFor="maxComp">Total Cap</Label>
                  <Input id="maxComp" type="number" className="mt-1" placeholder="Unlimited"
                    value={editing.max_completions ?? ""}
                    onChange={e => setEditing(prev => ({ ...prev, max_completions: e.target.value ? parseInt(e.target.value) : null }))} />
                  <p className="text-xs text-muted-foreground mt-1">All users combined</p>
                </div>
                <div>
                  <Label htmlFor="perUserCap">Per-user Limit</Label>
                  <Input
                    id="perUserCap"
                    type="number"
                    min={1}
                    className="mt-1"
                    placeholder="No limit"
                    disabled={isVideo}
                    value={isVideo ? 1 : (editing.max_completions_per_user ?? "")}
                    onChange={e => setEditing(prev => ({ ...prev, max_completions_per_user: e.target.value ? parseInt(e.target.value) : null }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isVideo ? "Locked to 1 for videos" : "Times per user"}
                  </p>
                </div>
              </div>

              {!isVideo && !isSocial && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cost Type</Label>
                    <Select value={editing.cost_type ?? "flat"}
                      onValueChange={v => setEditing(prev => ({ ...prev, cost_type: v as "flat" | "cpa" }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat (pre-paid budget)</SelectItem>
                        <SelectItem value="cpa">CPA (per completion)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="advCost">Advertiser Cost (kobo)</Label>
                    <Input id="advCost" type="number" className="mt-1" placeholder="No external revenue"
                      value={editing.advertiser_cost_kobo ?? ""}
                      onChange={e => setEditing(prev => ({ ...prev, advertiser_cost_kobo: e.target.value ? parseInt(e.target.value) : null }))} />
                  </div>
                </div>
              )}

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
