import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

async function assertAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return data && ["admin", "super_admin"].includes(data.role)
}

const reviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  admin_notes: z.string().max(1000).optional().nullable(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: submission } = await admin.from("task_submissions").select("*").eq("id", id).single()
  if (!submission) return NextResponse.json({ data: null, error: "Submission not found" }, { status: 404 })
  if (submission.status !== "pending") {
    return NextResponse.json({ data: null, error: "This submission has already been reviewed." }, { status: 400 })
  }

  const { decision, admin_notes } = parsed.data

  if (decision === "reject") {
    const { error } = await admin
      .from("task_submissions")
      .update({ status: "rejected", admin_notes: admin_notes ?? null, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq("id", id)
    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

    await auditLog({
      actorId: user.id, action: "advertiser.submission.reject", targetType: "task_submission", targetId: id,
      details: { admin_notes }, ipAddress: getClientIp(request.headers),
    })
    return NextResponse.json({ data: { status: "rejected" }, error: null })
  }

  // Approve — create the live task from the submission.
  const advertiserCostKobo = submission.cost_type === "cpa" ? submission.proposed_reward_kobo : submission.budget_kobo
  const { data: task, error: taskError } = await admin
    .from("tasks")
    .insert({
      title: submission.task_title,
      description: submission.description,
      instructions: submission.instructions ?? submission.description,
      category_id: submission.category_id,
      type: submission.task_type,
      status: "draft", // admin reviews once more before flipping to active
      reward_amount: submission.proposed_reward_kobo,
      max_completions: submission.desired_completions,
      requires_proof: submission.task_type === "verified",
      proof_instructions: submission.proof_requirements,
      verification_url: submission.verification_url,
      created_by: user.id,
      task_source: "advertiser",
      cost_type: submission.cost_type,
      advertiser_cost_kobo: advertiserCostKobo,
      submission_id: submission.id,
    })
    .select()
    .single()

  if (taskError) return NextResponse.json({ data: null, error: taskError.message }, { status: 500 })

  const { error: updateError } = await admin
    .from("task_submissions")
    .update({
      status: "approved", admin_notes: admin_notes ?? null, created_task_id: task.id,
      reviewed_at: new Date().toISOString(), reviewed_by: user.id,
    })
    .eq("id", id)
  if (updateError) return NextResponse.json({ data: null, error: updateError.message }, { status: 500 })

  await auditLog({
    actorId: user.id, action: "advertiser.submission.approve", targetType: "task_submission", targetId: id,
    details: { created_task_id: task.id }, ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data: { status: "approved", task }, error: null })
}
