import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { creditSignupBonus, processReferral } from "@/lib/referrals"
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

    return NextResponse.json({ data: { success: true }, error: null })
  }

  // APPROVE — create Supabase auth user with a temporary password, then send password reset
  const tempPassword = `Bt${Math.random().toString(36).slice(2, 12)}!`

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: record.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: record.full_name, referral_code: record.referral_code },
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { data: null, error: authError?.message ?? "Account creation failed." },
      { status: 500 }
    )
  }

  const userId = authData.user.id

  // Send password reset so user sets their own password
  await admin.auth.admin.generateLink({
    type: "recovery",
    email: record.email,
  })

  // Credit signup bonus + referral
  try { await creditSignupBonus(userId) } catch {}
  if (record.referral_code) {
    try { await processReferral(userId, record.referral_code) } catch {}
  }

  // Mark verified
  await admin.from("pending_verifications").update({
    status: "approved",
    notes: notes ?? null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq("id", id)

  await auditLog({
    actorId: user.id,
    action: "verification.approve",
    targetType: "user",
    targetId: userId,
    details: { email: record.email, method: record.payment_method },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data: { success: true, userId }, error: null })
}
