import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
      { user_id: user.id, task_id: taskId, started_at: new Date().toISOString(), heartbeat_count: 0, last_heartbeat_at: null },
      { onConflict: "user_id,task_id" }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
