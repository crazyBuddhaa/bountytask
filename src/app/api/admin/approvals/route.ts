import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendLedger } from "@/lib/ledger"
import { creditReferralBonus } from "@/lib/referrals"
import { recalcUserTier } from "@/lib/tiers"
import { notifyTaskApproved, notifyTaskRejected } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { getActiveAdminRole, parsePagination } from "@/lib/security"
import { z } from "zod"

export const dynamic = 'force-dynamic'

function isUniqueViolation(err: unknown): boolean {
  if (!err) return false
  const code = (err as { code?: string }).code
  if (code === "23505") return true
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("23505") || msg.includes("duplicate key")
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  const { isAdmin } = await getActiveAdminRole(user.id)
  if (!isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { page, limit } = parsePagination(request.nextUrl.searchParams, 20, 100)
  const taskId = request.nextUrl.searchParams.get("task_id")
  const from = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from("task_completions")
    // task_completions has two FKs to users (user_id, reviewed_by); the embed is ambiguous
    // without an explicit FK hint and PostgREST rejects the query, which was silently
    // surfacing as an empty "0 pending submissions" queue.
    .select("*, task:tasks(id,title,reward_amount,type,social_platform,social_action), user:users!task_completions_user_id_fkey(id,full_name,email,username)", { count: "exact" })
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .range(from, from + limit - 1)

  if (taskId) query = query.eq("task_id", taskId)
  const { data, count } = await query

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, error: null })
}

const actionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  const { isAdmin } = await getActiveAdminRole(user.id)
  if (!isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })

  const { ids, action, reason } = parsed.data
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const results: string[] = []

  for (const completionId of ids) {
    const updatePayload =
      action === "approve"
        ? { status: "approved", reviewed_at: now, reviewed_by: user.id }
        : { status: "rejected", reviewed_at: now, reviewed_by: user.id, rejection_reason: reason ?? "Does not meet requirements" }

    // Conditional update FIRST so concurrent approvals cannot double-credit the ledger
    const { data: completion, error: updateErr } = await admin
      .from("task_completions")
      .update(updatePayload)
      .eq("id", completionId)
      .eq("status", "pending")
      .select("*, task:tasks(title,reward_amount), user:users!task_completions_user_id_fkey(id,email,full_name)")
      .maybeSingle()

    if (updateErr) {
      return NextResponse.json({ data: null, error: updateErr.message }, { status: 500 })
    }

    if (!completion) {
      if (ids.length === 1) {
        return NextResponse.json(
          { data: null, error: "Completion is no longer pending or was already processed" },
          { status: 409 }
        )
      }
      continue
    }

    if (action === "approve") {
      try {
        await appendLedger({
          userId: completion.user_id, type: "credit", delta: completion.task.reward_amount,
          refType: "task_reward", refId: completionId, note: `Task: ${completion.task.title}`, createdBy: user.id,
        })
      } catch (err) {
        if (!isUniqueViolation(err)) {
          throw err
        }
      }
      await notifyTaskApproved(completion.user_id, completion.user.email, completion.task.title, completion.task.reward_amount, completionId)
      await creditReferralBonus(completion.user_id)
      await recalcUserTier(completion.user_id)
    } else {
      await notifyTaskRejected(completion.user_id, completion.user.email, completion.task.title, reason ?? "Does not meet requirements", completionId)
    }

    await auditLog({ actorId: user.id, action: `completion.${action}`, targetType: "task_completions", targetId: completionId,
      details: { reason }, ipAddress: getClientIp(request.headers) })
    results.push(completionId)
  }

  if (results.length === 0) {
    return NextResponse.json(
      { data: null, error: "No pending completions were updated" },
      { status: 409 }
    )
  }

  return NextResponse.json({ data: { processed: results.length, ids: results }, error: null })
}
