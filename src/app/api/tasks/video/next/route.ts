import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  // Optional comma-separated skipped video task IDs from the user's current session
  const skipParam = request.nextUrl.searchParams.get("skip") ?? ""
  const skipIds = skipParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
    .slice(0, 50)

  // Find IDs of video tasks this user has already completed (pending or approved)
  const { data: done } = await admin
    .from("task_completions")
    .select("task_id")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved"])

  const excludeIds = Array.from(
    new Set([...(done ?? []).map((r) => r.task_id), ...skipIds])
  )

  // Fetch next unwatched active video task — oldest first (FIFO queue)
  let query = admin
    .from("tasks")
    .select("*, category:task_categories(id,name,slug)")
    .eq("status", "active")
    .not("youtube_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  const raw = data?.[0] ?? null
  if (!raw) {
    return NextResponse.json({ data: null, error: null })
  }

  // Never leak video_secret_code to the browser; expose only has_secret_code boolean
  const { video_secret_code, ...safeTask } = raw as Record<string, unknown>
  const hasSecretCode =
    typeof video_secret_code === "string" && video_secret_code.trim().length > 0

  return NextResponse.json({
    data: { ...safeTask, has_secret_code: hasSecretCode },
    error: null,
  })
}
