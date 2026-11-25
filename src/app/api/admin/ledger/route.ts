import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAdminRole, parsePagination } from "@/lib/security"

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  const { isAdmin } = await getActiveAdminRole(user.id)
  if (!isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const searchParams = request.nextUrl.searchParams
  const { page, limit } = parsePagination(searchParams, 50, 200)
  const userId = searchParams.get("user_id")
  const refType = searchParams.get("ref_type")
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const from = (page - 1) * limit

  if (userId && !UUID_RE.test(userId)) {
    return NextResponse.json({ data: null, error: "Invalid user_id: must be a valid UUID" }, { status: 400 })
  }

  const admin = createAdminClient()
  let query = admin
    .from("ledger")
    .select("*, user:users(id,full_name,email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (userId) query = query.eq("user_id", userId)
  if (refType) query = query.eq("ref_type", refType)
  if (dateFrom) query = query.gte("created_at", dateFrom)
  if (dateTo) {
    const normalizedDateTo = DATE_ONLY_RE.test(dateTo) ? `${dateTo}T23:59:59.999Z` : dateTo
    query = query.lte("created_at", normalizedDateTo)
  }

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, error: null })
}
