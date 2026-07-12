import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdvertiserSettings } from "@/lib/advertiser"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const submitSchema = z.object({
  company_name: z.string().min(2).max(120),
  contact_name: z.string().max(120).optional().nullable(),
  contact_email: z.string().email(),
  contact_phone: z.string().max(30).optional().nullable(),
  task_title: z.string().min(5).max(120),
  description: z.string().min(10),
  instructions: z.string().max(2000).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  task_type: z.enum(["verified", "unverified"]).default("verified"),
  proposed_reward_kobo: z.number().int().positive(),
  desired_completions: z.number().int().positive().optional().nullable(),
  budget_kobo: z.number().int().positive(),
  cost_type: z.enum(["flat", "cpa"]).default("flat"),
  proof_requirements: z.string().max(1000).optional().nullable(),
  verification_url: z.string().url().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const settings = await getAdvertiserSettings()
  if (!settings.submissions_enabled) {
    return NextResponse.json(
      { data: null, error: "Advertiser submissions are currently closed. Please check back later." },
      { status: 403 }
    )
  }

  const body = await request.json()
  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const data = parsed.data
  if (data.budget_kobo < settings.min_budget_kobo) {
    return NextResponse.json(
      { data: null, error: `Minimum budget is ₦${(settings.min_budget_kobo / 100).toLocaleString("en-NG")}` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: submission, error } = await admin
    .from("task_submissions")
    .insert({
      company_name: data.company_name,
      contact_name: data.contact_name ?? null,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone ?? null,
      task_title: data.task_title,
      description: data.description,
      instructions: data.instructions ?? null,
      category_id: data.category_id ?? null,
      task_type: data.task_type,
      proposed_reward_kobo: data.proposed_reward_kobo,
      desired_completions: data.desired_completions ?? null,
      budget_kobo: data.budget_kobo,
      cost_type: data.cost_type,
      proof_requirements: data.proof_requirements ?? null,
      verification_url: data.verification_url ?? null,
      payment_status: settings.submission_fee_enabled ? "unpaid" : "waived",
    })
    .select()
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({
    action: "advertiser.submission.create",
    targetType: "task_submission",
    targetId: submission.id,
    details: { company_name: data.company_name, contact_email: data.contact_email, budget_kobo: data.budget_kobo },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({
    data: {
      submission,
      requires_payment: settings.submission_fee_enabled,
      fee_amount: settings.submission_fee_kobo,
    },
    error: null,
  })
}
