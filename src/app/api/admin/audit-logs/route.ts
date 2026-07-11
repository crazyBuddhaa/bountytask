import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const actorId = searchParams.get("actor_id")
  const action = searchParams.get("action")
  const from = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from("audit_logs")
    .select("*, actor:users(id,full_name,email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (actorId) query = query.eq("actor_id", actorId)
  if (action) query = query.ilike("action", `%${action}%`)

  const { data, count } = await query
  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, error: null })
}
