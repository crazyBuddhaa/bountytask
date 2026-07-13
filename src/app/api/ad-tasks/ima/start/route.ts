/**
 * IMA SDK — start a rewarded video ad session.
 *
 * POST /api/ad-tasks/ima/start
 * Body: {} (no body needed)
 *
 * Returns: { token, adTagUrl, rewardKobo, cap: { used, cap } }
 *
 * The client stores the token and passes it to /api/ad-tasks/ima/complete
 * after the IMA AD_COMPLETE event fires. The token is HMAC-signed and has
 * a 10-minute TTL — enough time for the ad to load and play, but short
 * enough to prevent hoarding or replaying old tokens.
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdProviderSettings, checkAdDailyCap, generateImaToken } from "@/lib/ad-providers"
import { checkDailyTaskLimit } from "@/lib/tiers"

export const dynamic = "force-dynamic"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const settings = await getAdProviderSettings()
  const ima = settings.ima

  if (!ima.enabled || !ima.adTagUrl) {
    return NextResponse.json({ error: "IMA ads are not available" }, { status: 503 })
  }

  // Provider-specific daily cap, checked before generating a token
  const cap = await checkAdDailyCap(user.id, "ima", ima.dailyCap)
  if (cap.limited) {
    return NextResponse.json({
      error: `You've reached today's limit of ${ima.dailyCap} video ad${ima.dailyCap === 1 ? "" : "s"}. Come back tomorrow!`,
      cap,
    }, { status: 429 })
  }

  // Platform-wide tier daily limit — tasks + ads share the same daily budget
  const tierLimit = await checkDailyTaskLimit(user.id)
  if (tierLimit.limited) {
    return NextResponse.json({
      error: `You've reached your tier's daily task limit (${tierLimit.used}/${tierLimit.limit}). Invite more friends or complete more tasks to unlock a higher limit, or try again tomorrow.`,
      code: "DAILY_LIMIT_REACHED",
    }, { status: 429 })
  }

  const token = generateImaToken(user.id)

  return NextResponse.json({
    token,
    adTagUrl: ima.adTagUrl,
    rewardKobo: ima.rewardKobo,
    cap: { used: cap.used, cap: cap.cap },
  })
}
