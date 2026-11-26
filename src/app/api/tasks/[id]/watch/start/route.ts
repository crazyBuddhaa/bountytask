import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const durationSchema = z.object({
  duration_seconds: z.number().int().min(5).max(7200).optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const parsed = durationSchema.safeParse(body)
  const durationSeconds = parsed.success ? (parsed.data.duration_seconds ?? null) : null

  const admin = createAdminClient()

  // Verify this is an active video task
  const { data: task } = await admin
    .from("tasks")
    .select("id, youtube_url, status")
    .eq("id", taskId)
    .single()

  if (!task || !task.youtube_url) {
    return NextResponse.json({ error: "Not a video task" }, { status: 404 })
  }
  if (task.status !== "active") {
    return NextResponse.json({ error: "Task is not active" }, { status: 400 })
  }

  // Upsert — reset heartbeat count if they start over (e.g. revisit page)
  const { data, error } = await admin
    .from("video_watch_sessions")
    .upsert(
      {
        user_id: user.id,
        task_id: taskId,
        started_at: new Date().toISOString(),
        heartbeat_count: 0,
        last_heartbeat_at: null,
        ...(durationSeconds !== null ? { video_duration_seconds: durationSeconds } : {}),
      },
      { onConflict: "user_id,task_id" }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

/**
 * PATCH /api/tasks/[id]/watch/start
 * Records the real YouTube video duration once YT.Player fires onReady,
 * without resetting started_at or heartbeat_count. Only sets it once (when NULL).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const parsed = durationSchema.safeParse(body)
  if (!parsed.success || !parsed.data.duration_seconds) {
    return NextResponse.json({ error: "Invalid duration_seconds" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("video_watch_sessions")
    .update({ video_duration_seconds: parsed.data.duration_seconds })
    .eq("user_id", user.id)
    .eq("task_id", taskId)
    .is("video_duration_seconds", null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
