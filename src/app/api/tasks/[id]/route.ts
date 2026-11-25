import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/audit"
import { getActiveAdminRole } from "@/lib/security"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const updateTaskSchema = z.object({
  title:                        z.string().min(5).max(120).optional(),
  description:                  z.string().min(10).max(5000).optional(),
  instructions:                 z.string().min(10).max(5000).optional(),
  category_id:                  z.string().uuid().optional(),
  type:                         z.enum(["verified", "unverified"]).optional(),
  status:                       z.enum(["draft", "active", "paused", "completed", "archived"]).optional(),
  reward_amount:                z.number().int().positive().optional(),
  max_completions:              z.number().int().positive().nullable().optional(),
  max_completions_per_user:     z.number().int().positive().optional(),
  requires_proof:               z.boolean().optional(),
  proof_instructions:           z.string().max(2000).nullable().optional(),
  time_limit_hours:             z.number().int().positive().nullable().optional(),
  verification_url:             z.string().url().nullable().optional(),
  expires_at:                   z.string().datetime().nullable().optional(),
  youtube_url:                  z.string().url().nullable().optional(),
  min_watch_seconds:            z.number().int().positive().nullable().optional(),
  social_platform:              z.enum(["twitter_x", "instagram", "tiktok", "youtube", "facebook", "threads"]).nullable().optional(),
  social_action:                z.enum(["follow", "like", "comment", "repost", "subscribe"]).nullable().optional(),
  social_target_handle:         z.string().max(200).nullable().optional(),
  social_target_post_url:       z.string().url().nullable().optional(),
  social_required_comment_text: z.string().max(1000).nullable().optional(),
  ai_verify_screenshot:         z.boolean().optional(),
}).strict()

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .select("*, category:task_categories(*)")
    .eq("id", id)
    .single()
  if (error) return NextResponse.json({ data: null, error: "Task not found" }, { status: 404 })
  return NextResponse.json({ data, error: null })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { isAdmin } = await getActiveAdminRole(user.id)
  if (!isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = updateTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const updateFields = parsed.data
  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ data: null, error: "No valid fields to update" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from("tasks").update(updateFields).eq("id", id).select().single()
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({
    actorId: user.id,
    action: "task.update",
    targetType: "task",
    targetId: id,
    details: { fields: Object.keys(updateFields) },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data, error: null })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { isAdmin } = await getActiveAdminRole(user.id)
  if (!isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from("tasks").update({ status: "archived" }).eq("id", id)
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({
    actorId: user.id,
    action: "task.archive",
    targetType: "task",
    targetId: id,
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data: { success: true }, error: null })
}
