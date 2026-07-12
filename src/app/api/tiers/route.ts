import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserTierStatus } from "@/lib/tiers"

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const status = await getUserTierStatus(user.id)
  return NextResponse.json({ data: status, error: null })
}
