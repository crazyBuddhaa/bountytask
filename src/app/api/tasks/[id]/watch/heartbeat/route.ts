import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

// Minimum seconds between accepted heartbeats — prevents flooding
const MIN_INTERVAL_SECONDS = 8

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  // Fetch existing session
  const { data: session } = await admin
    .from("video_watch_sessions")
    .select("id, heartbeat_count, last_heartbeat_at")
    .eq("user_id", user.id)
    .eq("task_id", taskId)
    .single()

  if (!session) {
    return NextResponse.json({ error: "No watch session found. Call /watch/start first." }, { status: 400 })
  }

  // Rate-limit: reject if last heartbeat was too recent
  if (session.last_heartbeat_at) {
    const secondsSinceLast = (Date.now() - new Date(session.last_heartbeat_at).getTime()) / 1000
    if (secondsSinceLast < MIN_INTERVAL_SECONDS) {
      return NextResponse.json({ error: "Heartbeat too frequent" }, { status: 429 })
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("video_watch_sessions")
    .update({ heartbeat_count: session.heartbeat_count + 1, last_heartbeat_at: now })
    .eq("id", session.id)
    .select("heartbeat_count")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
