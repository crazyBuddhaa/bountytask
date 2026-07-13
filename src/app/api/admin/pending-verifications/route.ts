import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyVerificationApproved, notifyVerificationRejected } from "@/lib/notifications"
import { creditReferralBonus } from "@/lib/referrals"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

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
  const status = searchParams.get("status") ?? "pending"

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("pending_verifications")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null })
}

const actionSchema = z.object({
  id:     z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  notes:  z.string().optional(),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { id, action, notes } = parsed.data
  const admin = createAdminClient()

  const { data: record } = await admin
    .from("pending_verifications")
    .select("*")
    .eq("id", id)
    .single()

  if (!record) return NextResponse.json({ data: null, error: "Record not found" }, { status: 404 })
  if (record.status !== "pending") {
    return NextResponse.json({ data: null, error: "Already reviewed" }, { status: 409 })
  }

  if (action === "reject") {
    await admin.from("pending_verifications").update({
      status: "rejected",
      notes: notes ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq("id", id)

    try {
      await notifyVerificationRejected(record.email, record.full_name, notes ?? null)
    } catch {}

    return NextResponse.json({ data: { success: true }, error: null })
  }

  // APPROVE — this account already exists (verification now gates
  // withdrawals, not signup), so just flip kyc_verified on it.
  if (!record.user_id) {
    return NextResponse.json(
      { data: null, error: "This request has no linked account and can't be auto-approved." },
      { status: 422 }
    )
  }

  const { error: updateError } = await admin
    .from("users")
    .update({ kyc_verified: true })
    .eq("id", record.user_id)

  if (updateError) {
    return NextResponse.json({ data: null, error: updateError.message }, { status: 500 })
  }

  await admin.from("pending_verifications").update({
    status: "approved",
    notes: notes ?? null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq("id", id)

  // Email user — non-blocking
  try {
    await notifyVerificationApproved(record.email, record.full_name)
  } catch {}

  // Credit referral bonus if this user was referred and has completed a task.
  // (creditReferralBonus is idempotent and no-ops if already credited or no referral)
  try {
    await creditReferralBonus(record.user_id)
  } catch {}

  await auditLog({
    actorId: user.id,
    action: "verification.approve",
    targetType: "user",
    targetId: record.user_id,
    details: { email: record.email, method: record.payment_method },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data: { success: true, userId: record.user_id }, error: null })
}
