import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  // Check no active withdrawals reference this account
  const { count } = await admin
    .from("withdrawals")
    .select("id", { count: "exact", head: true })
    .eq("account_id", id)
    .in("status", ["pending", "under_review", "approved"])
  if ((count ?? 0) > 0) {
    return NextResponse.json({ data: null, error: "Cannot delete account with active withdrawals" }, { status: 409 })
  }

  const { error } = await admin
    .from("withdrawal_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  return NextResponse.json({ data: { success: true }, error: null })
}

export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  // Clear all defaults then set this one
  await admin.from("withdrawal_accounts").update({ is_default: false }).eq("user_id", user.id)
  const { data, error } = await admin
    .from("withdrawal_accounts")
    .update({ is_default: true })
    .eq("id", id).eq("user_id", user.id)
    .select().single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null })
}
