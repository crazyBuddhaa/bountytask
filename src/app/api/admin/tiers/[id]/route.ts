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

const updateSchema = z.object({
  name:             z.string().min(1).max(40).optional(),
  min_referrals:    z.number().int().min(0).optional(),
  min_completions:  z.number().int().min(0).optional(),
  daily_task_limit: z.number().int().min(1).optional(),
  perks:            z.string().max(1000).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tierId = parseInt(id)
  if (!Number.isInteger(tierId) || tierId < 1 || tierId > 6) {
    return NextResponse.json({ data: null, error: "Invalid tier id" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("tiers")
    .update({ ...parsed.data, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", tierId)
    .select()
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({
    actorId: user.id, action: "tier.update", targetType: "tiers", targetId: id,
    details: parsed.data, ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data, error: null })
}
