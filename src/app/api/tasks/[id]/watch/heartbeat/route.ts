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

  const { data: rpcData, error: rpcErr } = await admin.rpc("record_video_heartbeat", {
    p_user_id:              user.id,
    p_task_id:              taskId,
    p_min_interval_seconds: MIN_INTERVAL_SECONDS,
  })

  if (rpcErr) {
    console.error("[watch/heartbeat] record_video_heartbeat error:", rpcErr)
    return NextResponse.json({ error: "Failed to record heartbeat" }, { status: 500 })
  }

  const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as {
    found: boolean
    recorded: boolean
    heartbeat_count: number
  } | null

  if (!row) {
    return NextResponse.json({ error: "Failed to record heartbeat" }, { status: 500 })
  }

  if (!row.found) {
    return NextResponse.json({ error: "No watch session found. Call /watch/start first." }, { status: 400 })
  }

  if (!row.recorded) {
    return NextResponse.json({ error: "Heartbeat too frequent" }, { status: 429 })
  }

  return NextResponse.json({ data: { heartbeat_count: row.heartbeat_count } })
}
