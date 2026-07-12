import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createNotification } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { createHash } from "crypto"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 5

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
})

function hashCode(code: string, userId: string) {
  return createHash("sha256").update(`${code}:${userId}`).digest("hex")
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: record } = await admin
    .from("phone_verification_codes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!record) {
    return NextResponse.json({ data: null, error: "No verification code found. Request a new one." }, { status: 404 })
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await admin.from("phone_verification_codes").delete().eq("id", record.id)
    return NextResponse.json({ data: null, error: "That code expired. Request a new one." }, { status: 410 })
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await admin.from("phone_verification_codes").delete().eq("id", record.id)
    return NextResponse.json({ data: null, error: "Too many incorrect attempts. Request a new code." }, { status: 429 })
  }

  if (hashCode(parsed.data.code, user.id) !== record.code_hash) {
    await admin.from("phone_verification_codes").update({ attempts: record.attempts + 1 }).eq("id", record.id)
    return NextResponse.json({ data: null, error: "Incorrect code." }, { status: 400 })
  }

  const { error: updateError } = await admin
    .from("users")
    .update({ phone: record.phone, phone_verified: true })
    .eq("id", user.id)

  if (updateError) {
    return NextResponse.json({ data: null, error: "Failed to confirm verification. Try again." }, { status: 500 })
  }

  await admin.from("phone_verification_codes").delete().eq("id", record.id)

  await Promise.all([
    createNotification({
      userId: user.id, type: "general", title: "Phone Verified",
      message: "Your phone number has been verified.",
    }),
    auditLog({
      actorId: user.id, action: "verification.phone_confirm", targetType: "user", targetId: user.id,
      details: { phone: record.phone }, ipAddress: getClientIp(request.headers),
    }),
  ])

  return NextResponse.json({ data: { success: true }, error: null })
}
