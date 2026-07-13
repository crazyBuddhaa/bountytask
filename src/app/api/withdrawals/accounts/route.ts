import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveAccount } from "@/lib/paystack"
import { auditLog } from "@/lib/audit"
import { getClientIp, namesRoughlyMatch } from "@/lib/utils"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const addSchema = z.object({
  bank_code: z.string().min(2),
  bank_name: z.string().min(2),
  account_number: z.string().length(10, "Account number must be 10 digits"),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("withdrawal_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })

  return NextResponse.json({ data: data ?? [], error: null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })

  const { bank_code, bank_name, account_number } = parsed.data

  // Verify via Paystack
  let account_name: string
  try {
    const resolved = await resolveAccount(account_number, bank_code)
    account_name = resolved.account_name
  } catch (e: unknown) {
    return NextResponse.json({ data: null, error: (e as Error).message }, { status: 422 })
  }

  // The bank account must belong to the same person as the profile — prevents
  // withdrawing to someone else's account.
  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single()

  if (!profile?.full_name || !namesRoughlyMatch(profile.full_name, account_name)) {
    return NextResponse.json(
      {
        data: null,
        error: `This bank account is registered to "${account_name}", which doesn't match your profile name "${profile?.full_name ?? "—"}". Withdrawal accounts must be in your own name.`,
      },
      { status: 422 }
    )
  }

  const admin = createAdminClient()

  // Check if this is the first account → set as default
  const { count } = await admin
    .from("withdrawal_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
  const isFirst = (count ?? 0) === 0

  const { data, error } = await admin
    .from("withdrawal_accounts")
    .insert({ user_id: user.id, bank_code, bank_name, account_number, account_name, is_verified: true, is_default: isFirst })
    .select().single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await auditLog({ actorId: user.id, action: "withdrawal_account.add", targetType: "withdrawal_accounts",
    targetId: data.id, details: { bank_name, account_number: account_number.slice(-4) },
    ipAddress: getClientIp(request.headers) })

  return NextResponse.json({ data, error: null }, { status: 201 })
}
