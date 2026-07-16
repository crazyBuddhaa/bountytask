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
// straight to Supabase's update() causes "Could not find the '<field>' column of 'tasks'
// in the schema cache". Always sanitize server-side, independent of what the client sends.
const EDITABLE_TASK_FIELDS = [
  "title", "description", "instructions", "category_id", "type", "status",
  "reward_amount", "max_completions", "max_completions_per_user", "requires_proof", "proof_instructions",
  "time_limit_hours", "verification_url", "expires_at", "cost_type", "advertiser_cost_kobo",
  "youtube_url", "min_watch_seconds",
] as const

function sanitizeTaskBody(body: Record<string, unknown>) {
  const clean: Record<string, unknown> = {}
  for (const key of EDITABLE_TASK_FIELDS) {
    if (key in body) clean[key] = body[key]
  }
  return clean
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = sanitizeTaskBody(await request.json())
  const admin = createAdminClient()
  const { data, error } = await admin.from("tasks").update(body).eq("id", id).select().single()
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({ actorId: user.id, action: "task.update", targetType: "task", targetId: id,
    details: { fields: Object.keys(body) }, ipAddress: getClientIp(request.headers) })

  return NextResponse.json({ data, error: null })
}
