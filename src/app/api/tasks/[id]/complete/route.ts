import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendLedger } from "@/lib/ledger"
import { creditReferralBonus } from "@/lib/referrals"
import { flagUser, checkTaskCompletionRate, recordDevice } from "@/lib/fraud"
import { checkDailyTaskLimit, recalcUserTier } from "@/lib/tiers"
import { notifyTaskApproved } from "@/lib/notifications"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  proof_url: z.string().url().optional().nullable(),
  proof_text: z.string().max(2000).optional().nullable(),
  device_fingerprint: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch task
  const { data: task, error: taskErr } = await admin
    .from("tasks").select("*, category:task_categories(name)").eq("id", taskId).single()
  if (taskErr || !task) return NextResponse.json({ data: null, error: "Task not found" }, { status: 404 })
  if (task.status !== "active") return NextResponse.json({ data: null, error: "Task is not active" }, { status: 400 })
  if (task.created_by === user.id) return NextResponse.json({ data: null, error: "You cannot complete your own task" }, { status: 403 })
  if (task.expires_at && new Date(task.expires_at) < new Date()) {
    return NextResponse.json({ data: null, error: "Task has expired" }, { status: 400 })
  }
  if (task.max_completions !== null && task.current_completions >= task.max_completions) {
    return NextResponse.json({ data: null, error: "Task is fully claimed" }, { status: 400 })
  }

  // Social tasks always require a screenshot (proof_url); check before the generic requires_proof check
  if (task.social_platform && !parsed.data.proof_url) {
    return NextResponse.json(
      { data: null, error: "A screenshot is required for this social media task." },
      { status: 400 }
    )
  }

  if (task.requires_proof && !parsed.data.proof_url && !parsed.data.proof_text) {
    return NextResponse.json({ data: null, error: "This task requires proof of completion" }, { status: 400 })
  }

  // ── Video task: server-side watch verification ──────────────────────────────
  if (task.youtube_url) {
    const { data: session } = await admin
      .from("video_watch_sessions")
      .select("heartbeat_count")
      .eq("user_id", user.id)
      .eq("task_id", taskId)
      .single()

    if (!session || session.heartbeat_count === 0) {
      return NextResponse.json({
        data: null,
        error: "You must watch the video before claiming the reward.",
      }, { status: 403 })
    }

    const watchedSeconds = session.heartbeat_count * 10
    const required = task.min_watch_seconds ?? 30

    if (watchedSeconds < required) {
      const remaining = Math.ceil((required - watchedSeconds) / 60)
      return NextResponse.json({
        data: null,
        error: `Keep watching — you need at least ${remaining} more minute${remaining === 1 ? "" : "s"} of watch time.`,
      }, { status: 403 })
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  // Per-user completion limit check
  const perUserLimit = task.max_completions_per_user ?? 1
  const { count: userCount } = await admin
    .from("task_completions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("task_id", taskId)
    .in("status", ["pending", "approved"])
  if ((userCount ?? 0) >= perUserLimit) {
    return NextResponse.json({
      data: null,
      error: perUserLimit === 1
        ? "You have already submitted this task"
        : `You've completed this task ${perUserLimit} time${perUserLimit === 1 ? "" : "s"} — that's the maximum allowed.`,
    }, { status: 409 })
  }

  // Remaining fraud checks
  const [rateLimited, dailyLimit] = await Promise.all([
    checkTaskCompletionRate(user.id),
    checkDailyTaskLimit(user.id),
  ])
  if (rateLimited) {
    await flagUser({ userId: user.id, reason: "Exceeded task completion rate limit (10/hr)", severity: "medium" })
    return NextResponse.json({ data: null, error: "Too many submissions. Please wait before trying again." }, { status: 429 })
  }
  if (dailyLimit.limited) {
    return NextResponse.json({
      data: null,
      error: `You've reached your tier's daily task limit (${dailyLimit.used}/${dailyLimit.limit}). Invite more friends to unlock a higher limit, or try again tomorrow.`,
      code: "DAILY_LIMIT_REACHED",
    }, { status: 429 })
  }

  // Record device
  if (parsed.data.device_fingerprint) {
    await recordDevice({
      userId: user.id, fingerprint: parsed.data.device_fingerprint,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent") ?? undefined,
    })
  }

  const now = new Date().toISOString()

  // Video and instant tasks are auto-approved; verified and social tasks default to pending
  let completionStatus: "pending" | "approved" =
    (task.type === "unverified" || task.youtube_url) ? "approved" : "pending"

  // ── Social task: optional AI screenshot verification ───────────────────────
  let aiVerdict: { verdict: string; confidence: number; reason: string } | null = null

  if (task.social_platform && task.ai_verify_screenshot && parsed.data.proof_url) {
    const { verifySocialScreenshot } = await import("@/lib/ai-vision")
    const verdict = await verifySocialScreenshot(parsed.data.proof_url, task)
    aiVerdict = verdict

    if (verdict.verdict === "rejected") {
      // Return without inserting a completion row so the user can retry with a
      // better screenshot. Rejected completions don't count toward the per-user cap.
      return NextResponse.json(
        { data: null, error: verdict.reason, code: "AI_REJECTED" },
        { status: 422 }
      )
    }

    // AI approved → instant credit (no admin review needed)
    if (verdict.verdict === "approved") {
      completionStatus = "approved"
    }
    // AI uncertain → stays "pending" for manual review
  }
  // ───────────────────────────────────────────────────────────────────────────

  // Insert completion
  const { data: completion, error: compErr } = await admin
    .from("task_completions")
    .insert({
      task_id: taskId,
      user_id: user.id,
      status: completionStatus,
      proof_url: parsed.data.proof_url ?? null,
      proof_text: parsed.data.proof_text ?? null,
      submitted_at: now,
      reviewed_at: completionStatus === "approved" ? now : null,
      // AI verdict (null for non-AI tasks)
      ...(aiVerdict ? {
        ai_verdict: aiVerdict.verdict,
        ai_confidence: aiVerdict.confidence,
        ai_reason: aiVerdict.reason,
      } : {}),
    })
    .select().single()

  if (compErr) {
    if (compErr.code === "23505") return NextResponse.json({ data: null, error: "Already submitted" }, { status: 409 })
    return NextResponse.json({ data: null, error: compErr.message }, { status: 500 })
  }

  // Auto-approve: credit ledger + notifications
  if (completionStatus === "approved") {
    const [ledgerEntry] = await Promise.all([
      appendLedger({
        userId: user.id, type: "credit", delta: task.reward_amount,
        refType: "task_reward", refId: completion.id, note: `Task: ${task.title}`,
      }),
    ])
    const { data: profile } = await admin.from("users").select("email").eq("id", user.id).single()
    await Promise.all([
      notifyTaskApproved(user.id, profile?.email ?? "", task.title, task.reward_amount, completion.id),
      creditReferralBonus(user.id),
      recalcUserTier(user.id),
    ])
    void ledgerEntry
  }

  return NextResponse.json({ data: completion, error: null }, { status: 201 })
}
