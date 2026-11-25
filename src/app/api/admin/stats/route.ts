import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAdminRole } from "@/lib/security"

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!(await getActiveAdminRole(user.id)).isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("get_platform_stats")
  if (error) {
    console.error("get_platform_stats RPC error:", error)
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data, error: null })
}
