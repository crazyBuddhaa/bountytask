import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdTaskStatusForUser } from "@/lib/ad-providers"

export const dynamic = "force-dynamic"

/**
 * Ad-task cards for the Available Tasks grid.
 * Returns only providers that are enabled and fully configured by the
 * admin — never leaks provider secrets, only what the UI needs to render
 * a card and its daily-cap progress.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const data = await getAdTaskStatusForUser(user.id)
  return NextResponse.json({ data, error: null })
}
