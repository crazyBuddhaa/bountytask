import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLiveBalance } from "@/lib/ledger"
import { flagUser } from "@/lib/fraud"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { getActiveAdminRole } from "@/lib/security"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  role: z.enum(["user", "admin", "super_admin"]).optional(),
  is_active: z.boolean().optional(),
  kyc_verified: z.boolean().optional(),
  // Manual tier override — takes effect immediately, but a later referral
  // recalculation will never drop it back below this value automatically.
  tier: z.number().int().min(1).max(6).optional(),
})

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  const actor = await getActiveAdminRole(user.id)
  if (!actor.isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const [profileResult, balance, ledgerResult, fraudResult] = await Promise.all([
    admin.from("users").select("*").eq("id", id).single(),
    getLiveBalance(id),
    admin.from("ledger").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    admin.from("fraud_flags").select("*").eq("user_id", id).eq("resolved", false).order("created_at", { ascending: false }),
  ])

  if (!profileResult.data) return NextResponse.json({ data: null, error: "User not found" }, { status: 404 })
  return NextResponse.json({
    data: { ...profileResult.data, balance, recent_ledger: ledgerResult.data, fraud_flags: fraudResult.data },
    error: null,
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  const actor = await getActiveAdminRole(user.id)
  if (!actor.isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })

  if (id === user.id && (parsed.data.role !== undefined || parsed.data.is_active === false)) {
    return NextResponse.json(
      { data: null, error: "You cannot change your own role or deactivate your own account." },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: targetUser } = await admin.from("users").select("role").eq("id", id).single()
  if (!targetUser) return NextResponse.json({ data: null, error: "User not found" }, { status: 404 })

  const targetIsAdmin = targetUser.role === "admin" || targetUser.role === "super_admin"
  if ((parsed.data.role !== undefined || targetIsAdmin) && !actor.isSuperAdmin) {
    return NextResponse.json(
      { data: null, error: "Only super admins can change roles or modify admin accounts." },
      { status: 403 }
    )
  }

  const { data, error } = await admin.from("users").update(parsed.data).eq("id", id).select().single()
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  if (parsed.data.is_active === false) {
    await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" })
    await flagUser({ userId: id, reason: "Account deactivated by admin", severity: "high",
      details: { by: user.id } })
  } else if (parsed.data.is_active === true) {
    await admin.auth.admin.updateUserById(id, { ban_duration: "none" })
  }

  await auditLog({ actorId: user.id, action: "admin.user.update", targetType: "user", targetId: id,
    details: parsed.data, ipAddress: getClientIp(request.headers) })

  return NextResponse.json({ data, error: null })
}
