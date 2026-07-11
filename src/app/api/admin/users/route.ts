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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100)
  const search = searchParams.get("search")
  const role = searchParams.get("role")
  const from = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,username.ilike.%${search}%`)
  if (role) query = query.eq("role", role)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  // Fetch live balances for each user
  const usersWithBalance = await Promise.all(
    (data ?? []).map(async (u) => {
      const { data: bal } = await admin.rpc("get_user_balance", { p_user_id: u.id })
      return { ...u, balance: bal ?? 0 }
    })
  )

  return NextResponse.json({ data: usersWithBalance, total: count ?? 0, page, limit, error: null })
}
