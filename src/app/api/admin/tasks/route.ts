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

// Whitelist of real, writable `tasks` columns. Clients may also send read-only/joined
// fields (e.g. `category` from a `category:task_categories(...)` select) — passing those
// straight to Supabase's insert()/update() causes "Could not find the '<field>' column of
// 'tasks' in the schema cache". Always sanitize server-side, independent of what the client sends.
const EDITABLE_TASK_FIELDS = [
  "title", "description", "instructions", "category_id", "type", "status",
  "reward_amount", "max_completions", "requires_proof", "proof_instructions",
  "time_limit_hours", "verification_url", "expires_at", "cost_type", "advertiser_cost_kobo",
] as const

function sanitizeTaskBody(body: Record<string, unknown>) {
  const clean: Record<string, unknown> = {}
  for (const key of EDITABLE_TASK_FIELDS) {
    if (key in body) clean[key] = body[key]
  }
  return clean
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

  const body = sanitizeTaskBody(await request.json())
  const admin = createAdminClient()
  const { data, error } = await admin.from("tasks").insert({ ...body, created_by: user.id }).select().single()
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({ actorId: user.id, action: "task.create", targetType: "task", targetId: data.id,
    details: { title: data.title }, ipAddress: getClientIp(request.headers) })

  return NextResponse.json({ data, error: null }, { status: 201 })
}
