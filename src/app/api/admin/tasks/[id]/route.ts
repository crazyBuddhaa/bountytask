import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"

export const dynamic = 'force-dynamic'

async function assertAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return data && ["admin", "super_admin"].includes(data.role)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from("tasks").update(body).eq("id", id).select().single()
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({ actorId: user.id, action: "task.update", targetType: "task", targetId: id,
    details: { fields: Object.keys(body) }, ipAddress: getClientIp(request.headers) })

  return NextResponse.json({ data, error: null })
}
