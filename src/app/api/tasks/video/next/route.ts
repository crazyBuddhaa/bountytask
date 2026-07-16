import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  // Find IDs of video tasks this user has already completed (pending or approved)
  const { data: done } = await admin
    .from("task_completions")
    .select("task_id")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved"])

  const doneIds = (done ?? []).map(r => r.task_id)

  // Fetch next unwatched active video task — oldest first (FIFO queue)
  let query = admin
    .from("tasks")
    .select("*, category:task_categories(id,name,slug)")
    .eq("status", "active")
    .not("youtube_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)

  if (doneIds.length > 0) {
    query = query.not("id", "in", `(${doneIds.join(",")})`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  const task = data?.[0] ?? null
  return NextResponse.json({ data: task, error: null })
}
