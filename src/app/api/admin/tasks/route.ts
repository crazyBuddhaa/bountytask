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
  const status = searchParams.get("status")
  const from = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from("tasks")
    .select("*, category:task_categories(id,name,slug)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (status) query = query.eq("status", status)
  const { data, count } = await query

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, error: null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from("tasks").insert({ ...body, created_by: user.id }).select().single()
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({ actorId: user.id, action: "task.create", targetType: "task", targetId: data.id,
    details: { title: data.title }, ipAddress: getClientIp(request.headers) })

  return NextResponse.json({ data, error: null }, { status: 201 })
}
