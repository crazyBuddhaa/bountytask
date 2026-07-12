import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// Guard against garbage/clock-tampered durations from the client.
const MAX_DURATION_SECONDS = 3 * 60 * 60

/**
 * Updates the time-on-page for a view recorded via /api/analytics/track.
 * Called periodically while a page is visible and once more on unload
 * (via navigator.sendBeacon), so `duration` is always the total elapsed
 * seconds for that page view, not a delta.
 */
export async function POST(request: NextRequest) {
  let body: { viewId?: unknown; duration?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 })
  }

  const viewId = typeof body.viewId === "string" ? body.viewId : null
  const duration = Number(body.duration)
  if (!viewId || !Number.isFinite(duration) || duration < 0) {
    return NextResponse.json({ ok: false, error: "viewId and duration are required" }, { status: 400 })
  }

  const admin = createAdminClient()
  await admin
    .from("analytics_page_views")
    .update({
      duration_seconds: Math.min(Math.round(duration), MAX_DURATION_SECONDS),
      updated_at: new Date().toISOString(),
    })
    .eq("id", viewId)

  return NextResponse.json({ ok: true })
}
