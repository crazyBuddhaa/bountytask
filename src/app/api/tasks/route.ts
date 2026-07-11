import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(10),
  instructions: z.string().min(10),
  category_id: z.string().uuid(),
  type: z.enum(["verified", "unverified"]),
  reward_amount: z.number().int().positive(),
  max_completions: z.number().int().positive().optional().nullable(),
  requires_proof: z.boolean().default(false),
  proof_instructions: z.string().optional().nullable(),
  time_limit_hours: z.number().int().positive().optional().nullable(),
  verification_url: z.string().url().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50)
  const category = searchParams.get("category")
  const type = searchParams.get("type")
  const search = searchParams.get("search")
  const from = (page - 1) * limit

  const supabase = await createClient()
  let query = supabase
    .from("tasks")
    .select("*, category:task_categories(id,name,slug,icon)", { count: "exact" })
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (category) query = query.eq("category_id", category)
  if (type) query = query.eq("type", type as "verified" | "unverified")
  if (search) query = query.ilike("title", `%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  return NextResponse.json({
    data, total: count ?? 0, page, limit, hasMore: (count ?? 0) > from + limit, error: null,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await admin
    .from("tasks")
    .insert({ ...parsed.data, created_by: user.id, status: body.status ?? "draft" })
    .select()
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({ actorId: user.id, action: "task.create", targetType: "task", targetId: data.id,
    details: { title: data.title }, ipAddress: getClientIp(request.headers) })

  return NextResponse.json({ data, error: null }, { status: 201 })
}
