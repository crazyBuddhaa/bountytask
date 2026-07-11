import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50)
  const from = (page - 1) * limit

  const { data, count } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("read", { ascending: true })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  return NextResponse.json({
    data: data ?? [], total: count ?? 0, page, limit,
    hasMore: (count ?? 0) > from + limit, error: null,
  })
}

const markReadSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()) }),
  z.object({ all: z.literal(true) }),
])

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = markReadSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: "Invalid body" }, { status: 400 })

  const admin = createAdminClient()
  let query = admin.from("notifications").update({ read: true }).eq("user_id", user.id)
  if ("ids" in parsed.data) query = query.in("id", parsed.data.ids)

  const { error } = await query
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  return NextResponse.json({ data: { success: true }, error: null })
}
