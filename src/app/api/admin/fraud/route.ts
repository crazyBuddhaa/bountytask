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

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100)
  const severity = searchParams.get("severity")
  const from = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from("fraud_flags")
    // fraud_flags has two FKs to users (user_id, resolved_by); without an explicit FK hint
    // the embed is ambiguous and PostgREST rejects the query, silently returning no rows.
    .select("*, user:users!fraud_flags_user_id_fkey(id,full_name,email)", { count: "exact" })
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (severity) query = query.eq("severity", severity)
  const { data, count } = await query

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, error: null })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ data: null, error: "id required" }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("fraud_flags")
    .update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", id).select().single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({ actorId: user.id, action: "fraud_flag.resolve", targetType: "fraud_flags", targetId: id,
    ipAddress: getClientIp(request.headers) })

  return NextResponse.json({ data, error: null })
}
