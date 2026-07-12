import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendAdminNotification } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

async function assertAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return data && ["admin", "super_admin"].includes(data.role)
}

const broadcastSchema = z.object({
  target: z.enum(["all", "user"]),
  userId: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  channels: z.array(z.enum(["in_app", "email"])).min(1, "Select at least one delivery channel"),
}).refine((v) => v.target === "all" || !!v.userId, {
  message: "userId is required when targeting a specific user",
  path: ["userId"],
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = broadcastSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { target, userId, title, message, channels } = parsed.data

  let result: { recipientCount: number }
  try {
    result = await sendAdminNotification({ target, userId, title, message, channels })
  } catch (e: unknown) {
    return NextResponse.json({ data: null, error: (e as Error).message }, { status: 400 })
  }

  await auditLog({
    actorId: user.id,
    action: "notification.broadcast",
    targetType: target === "all" ? "all_users" : "user",
    targetId: userId,
    details: { title, message, channels, recipientCount: result.recipientCount },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data: result, error: null }, { status: 201 })
}
