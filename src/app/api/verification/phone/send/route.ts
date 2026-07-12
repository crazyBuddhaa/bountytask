import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getVerificationSettings } from "@/lib/verification"
import { sendSms } from "@/lib/textbee"
import { createHash, randomInt } from "crypto"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // 1 minute

const schema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number in international format, e.g. +2348012345678"),
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

  const settings = await getVerificationSettings()
  if (!settings.phone_verification_enabled) {
    return NextResponse.json({ data: null, error: "Phone verification is not currently required." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from("users").select("phone_verified").eq("id", user.id).single()
  if (profile?.phone_verified) {
    return NextResponse.json({ data: null, error: "Your phone is already verified." }, { status: 409 })
  }

  const { data: recent } = await admin
    .from("phone_verification_codes")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
    return NextResponse.json({ data: null, error: "Please wait a minute before requesting another code." }, { status: 429 })
  }

  const { phone } = parsed.data
  const code = randomInt(100000, 999999).toString()

  try {
    await sendSms(phone, `Your BountyTask verification code is ${code}. It expires in 10 minutes.`)
  } catch (e) {
    return NextResponse.json({ data: null, error: (e as Error).message }, { status: 502 })
  }

  // Only one active code per user — replace any previous one.
  await admin.from("phone_verification_codes").delete().eq("user_id", user.id)
  const { error } = await admin.from("phone_verification_codes").insert({
    user_id: user.id,
    phone,
    code_hash: hashCode(code, user.id),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  })

  if (error) {
    return NextResponse.json({ data: null, error: "Failed to start verification. Try again." }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true }, error: null })
}
