import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const userId = searchParams.get("user_id")
  const refType = searchParams.get("ref_type")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const from = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from("ledger")
    .select("*, user:users(id,full_name,email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (userId) query = query.eq("user_id", userId)
  if (refType) query = query.eq("ref_type", refType)
  if (dateFrom) query = query.gte("created_at", dateFrom)
  if (dateTo) query = query.lte("created_at", dateTo)

  const { data, count } = await query
  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, error: null })
}
