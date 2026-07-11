import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendLedger } from "@/lib/ledger"
import { creditReferralBonus } from "@/lib/referrals"
import { notifyTaskApproved, notifyTaskRejected } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

async function assertAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return data && ["admin", "super_admin"].includes(data.role)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100)
  const taskId = searchParams.get("task_id")
  const from = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from("task_completions")
    .select("*, task:tasks(id,title,reward_amount,type), user:users(id,full_name,email,username)", { count: "exact" })
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
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })

  const { ids, action, reason } = parsed.data
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const results: string[] = []

  for (const completionId of ids) {
    const { data: completion } = await admin
      .from("task_completions")
      .select("*, task:tasks(title,reward_amount), user:users(id,email,full_name)")
      .eq("id", completionId)
      .eq("status", "pending")
      .single()

    if (!completion) continue

    if (action === "approve") {
      await admin.from("task_completions").update({ status: "approved", reviewed_at: now, reviewed_by: user.id }).eq("id", completionId)
      await appendLedger({
        userId: completion.user_id, type: "credit", delta: completion.task.reward_amount,
        refType: "task_reward", refId: completionId, note: `Task: ${completion.task.title}`, createdBy: user.id,
      })
      await notifyTaskApproved(completion.user_id, completion.user.email, completion.task.title, completion.task.reward_amount, completionId)
      await creditReferralBonus(completion.user_id)
    } else {
      await admin.from("task_completions").update({ status: "rejected", reviewed_at: now, reviewed_by: user.id, rejection_reason: reason ?? "Does not meet requirements" }).eq("id", completionId)
      await notifyTaskRejected(completion.user_id, completion.user.email, completion.task.title, reason ?? "Does not meet requirements", completionId)
    }

    await auditLog({ actorId: user.id, action: `completion.${action}`, targetType: "task_completions", targetId: completionId,
      details: { reason }, ipAddress: getClientIp(request.headers) })
    results.push(completionId)
  }

  return NextResponse.json({ data: { processed: results.length, ids: results }, error: null })
}
