/**
 * Adsterra smartlink click endpoint.
 *
 * Called by the client BEFORE opening the smartlink URL so the server can:
 *   1. Authenticate the request (logged-in user only)
 *   2. Enforce per-user cooldown (default 30 min between clicks)
 *   3. Enforce daily cap
 *   4. Enforce platform-wide tier daily limit
 *   5. Credit the ledger optimistically (no postback will ever arrive)
 *   6. Return the resolved smartlink URL for the client to window.open()
 *
 * POST /api/asterra/click
 * Body: {} (user identity comes from the auth session, not the body)
 *
 * Responses:
 *   200 { ok: true, url: string }     — credit applied, open this URL
 *   401 { error: "Unauthorized" }
 *   429 { error: "cooldown",  nextAvailableAt: ISO string }
 *   429 { error: "Daily cap reached" }
 *   429 { error: "Daily platform limit reached" }
 *   503 { error: "Provider not configured" }
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getAsterraSettings,
  buildAsterraSmartlinkUrl,
  getAsterraLastClickAt,
  ASTERRA_COOLDOWN_MINUTES,
} from "@/lib/asterra"
import { checkAdDailyCap, recordAdCompletion } from "@/lib/ad-providers"
import { checkDailyTaskLimit } from "@/lib/tiers"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  const settings = await getAsterraSettings()
  if (!settings.enabled || !settings.smartlinkUrl) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 })
  }

  // ── Cooldown check ────────────────────────────────────────────────────────
  const lastClickAt = await getAsterraLastClickAt(user.id)
  if (lastClickAt) {
    const cooldownMs   = ASTERRA_COOLDOWN_MINUTES * 60 * 1000
    const nextAvailableAt = new Date(lastClickAt.getTime() + cooldownMs)
    if (nextAvailableAt > new Date()) {
      return NextResponse.json(
        { error: "cooldown", nextAvailableAt: nextAvailableAt.toISOString() },
        { status: 429 }
      )
    }
  }

  // ── Daily cap ─────────────────────────────────────────────────────────────
  const cap = await checkAdDailyCap(user.id, "asterra", settings.dailyCap)
  if (cap.limited) {
    return NextResponse.json({ error: "Daily cap reached" }, { status: 429 })
  }

  // ── Platform tier limit ───────────────────────────────────────────────────
  const tierLimit = await checkDailyTaskLimit(user.id)
  if (tierLimit.limited) {
    return NextResponse.json({ error: "Daily platform limit reached" }, { status: 429 })
  }

  // ── Optimistic credit ─────────────────────────────────────────────────────
  // session_id is a server-generated UUID — there is no external transaction ID
  // because Adsterra has no per-user postback for publishers.
  const sessionId = crypto.randomUUID()

  await recordAdCompletion({
    userId:    user.id,
    provider:  "asterra",
    adType:    "mixed",
    rewardKobo: settings.rewardKobo,
    sessionId,
  })

  // ── Return resolved URL ───────────────────────────────────────────────────
  const url = buildAsterraSmartlinkUrl(settings.smartlinkUrl, user.id)
  return NextResponse.json({ ok: true, url })
}
