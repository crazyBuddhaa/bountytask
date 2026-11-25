import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkInMemoryRateLimit } from "@/lib/security"
import { z } from "zod"

export const dynamic = "force-dynamic"

// Guard against garbage/clock-tampered durations from the client.
const MAX_DURATION_SECONDS = 3 * 60 * 60
const uuidSchema = z.string().uuid()

/**
 * Updates the time-on-page for a view recorded via /api/analytics/track.
 * Called periodically while a page is visible and once more on unload
 * (via navigator.sendBeacon), so `duration` is always the total elapsed
 * seconds for that page view, not a delta.
 */
export async function POST(request: NextRequest) {
  const vid = request.cookies.get("bt_vid")?.value
  if (!vid) {
    return NextResponse.json({ ok: false, error: "Missing visitor cookie" }, { status: 400 })
  }

  const rateLimit = checkInMemoryRateLimit(`analytics-hb:${vid}`, 60, 60 * 1000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  let body: { viewId?: unknown; duration?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 })
  }

  const viewId = typeof body.viewId === "string" ? body.viewId : null
  const duration = Number(body.duration)
  if (!viewId || !uuidSchema.safeParse(viewId).success || !Number.isFinite(duration) || duration < 0) {
    return NextResponse.json({ ok: false, error: "Valid viewId and duration are required" }, { status: 400 })
  }

  const admin = createAdminClient()
  await admin
    .from("analytics_page_views")
    .update({
      duration_seconds: Math.min(Math.round(duration), MAX_DURATION_SECONDS),
      updated_at: new Date().toISOString(),
    })
    .eq("id", viewId)
    .eq("visitor_id", vid)

  return NextResponse.json({ ok: true })
}
