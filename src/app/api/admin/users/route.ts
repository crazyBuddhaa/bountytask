import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAdminRole, sanitizePostgrestSearch } from "@/lib/security"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!(await getActiveAdminRole(user.id)).isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

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

  if (search) {
    const cleanSearch = sanitizePostgrestSearch(search)
    if (cleanSearch) {
      query = query.or(`email.ilike.%${cleanSearch}%,full_name.ilike.%${cleanSearch}%,username.ilike.%${cleanSearch}%`)
    }
  }
  if (role) query = query.eq("role", role)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  // balance_kobo is a materialized column on users — no per-row RPC calls needed.
  // Previously this was an N+1 loop (one get_user_balance RPC per user).
  const usersWithBalance = (data ?? []).map(u => ({ ...u, balance: u.balance_kobo ?? 0 }))

  return NextResponse.json({ data: usersWithBalance, total: count ?? 0, page, limit, error: null })
}
