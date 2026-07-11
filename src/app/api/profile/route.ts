import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLiveBalance } from "@/lib/ledger"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  full_name: z.string().min(2).max(80).optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only").optional(),
  phone: z.string().max(20).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  const balance = await getLiveBalance(user.id)

  return NextResponse.json({ data: { ...profile, balance }, error: null })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const updates = parsed.data

  // Check username uniqueness
  if (updates.username) {
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from("users")
      .select("id")
      .eq("username", updates.username)
      .neq("id", user.id)
      .single()
    if (existing) {
      return NextResponse.json({ data: null, error: "Username already taken" }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({
    actorId: user.id,
    action: "profile.update",
    targetType: "user",
    targetId: user.id,
    details: { fields: Object.keys(updates) },
    ipAddress: getClientIp(request.headers),
  })

  return NextResponse.json({ data, error: null })
}
