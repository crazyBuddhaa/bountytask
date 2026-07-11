import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const settingsSchema = z.object({
  verification_fee_enabled:    z.boolean().optional(),
  verification_fee_amount:     z.number().int().positive().optional(),
  verification_payment_method: z.enum(["paystack", "bank_transfer"]).optional(),
  bank_transfer_name:          z.string().max(100).optional(),
  bank_transfer_number:        z.string().max(20).optional(),
  bank_transfer_bank:          z.string().max(100).optional(),
})

async function assertAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return data && ["admin", "super_admin"].includes(data.role)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { data: rows } = await admin.from("platform_settings").select("key, value")
  const settings = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))

  return NextResponse.json({ data: settings, error: null })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const admin = createAdminClient()
  const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined) as [string, unknown][]

  for (const [key, value] of entries) {
    await admin.from("platform_settings").upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: "key" }
    )
  }

  await auditLog({
    actorId: user.id,
    action: "settings.update",
    targetType: "platform_settings",
    targetId: null,
    details: { keys: entries.map(([k]) => k) },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data: { updated: entries.map(([k]) => k) }, error: null })
}
