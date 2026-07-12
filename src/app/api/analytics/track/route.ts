import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/**
 * Records one page-view event. Called by <PageViewTracker /> on every route
 * change, for both anonymous and signed-in visitors. Returns the new row's
 * id so the client can attach a duration to it via /api/analytics/heartbeat.
 */
export async function POST(request: NextRequest) {
  let body: { path?: unknown; sessionId?: unknown; referrer?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ id: null, error: "Invalid body" }, { status: 400 })
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 512) : null
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null
  if (!path || !sessionId) {
    return NextResponse.json({ id: null, error: "path and sessionId are required" }, { status: 400 })
  }

  // Set by middleware on every non-static request; if it's somehow absent
  // (e.g. cookie blocked), skip tracking rather than recording a null visitor.
  const visitorId = request.cookies.get("bt_vid")?.value
  if (!visitorId) return NextResponse.json({ id: null })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("analytics_page_views")
    .insert({
      visitor_id: visitorId,
      session_id: sessionId,
      user_id: user?.id ?? null,
      path,
      referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 512) : null,
      user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ id: null })
  return NextResponse.json({ id: data.id })
}
