import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendLedger, assertSufficientBalance } from "@/lib/ledger"
import { createNotification } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { z } from "zod"

const MIN_WITHDRAWAL = 500_000 // ₦5,000 in kobo

const requestSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.number().int().min(MIN_WITHDRAWAL, `Minimum withdrawal is ₦${MIN_WITHDRAWAL / 100}`),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50)
  const from = (page - 1) * limit

  const { data, count } = await supabase
    .from("withdrawals")
    .select("*, account:withdrawal_accounts(*)", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, error: null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })

  const { account_id, amount } = parsed.data
  const admin = createAdminClient()

  // Verify account belongs to user and is verified
  const { data: account } = await admin
    .from("withdrawal_accounts")
    .select("*")
    .eq("id", account_id)
    .eq("user_id", user.id)
    .eq("is_verified", true)
    .single()
  if (!account) return NextResponse.json({ data: null, error: "Account not found or not verified" }, { status: 404 })

  // Check no pending withdrawal exists
  const { count: pendingCount } = await admin
    .from("withdrawals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["pending", "under_review"])
  if ((pendingCount ?? 0) > 0) {
    return NextResponse.json({ data: null, error: "You already have a pending withdrawal request" }, { status: 409 })
  }

  // Check balance
  try { await assertSufficientBalance(user.id, amount) }
  catch (e: unknown) { return NextResponse.json({ data: null, error: (e as Error).message }, { status: 400 }) }

  // Create ledger debit
  const ledgerEntry = await appendLedger({
    userId: user.id, type: "debit", delta: amount, refType: "withdrawal_debit",
    note: `Withdrawal to ${account.bank_name} ${account.account_number}`, createdBy: user.id,
  })

  // Create withdrawal record
  const { data: withdrawal, error } = await admin
    .from("withdrawals")
    .insert({ user_id: user.id, account_id, amount, status: "pending", ledger_entry_id: ledgerEntry.id })
    .select("*, account:withdrawal_accounts(*)")
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  await Promise.all([
    createNotification({ userId: user.id, type: "general", title: "Withdrawal Requested",
      message: `Your withdrawal of ₦${(amount / 100).toFixed(2)} is under review.`, refId: withdrawal.id }),
    auditLog({ actorId: user.id, action: "withdrawal.request", targetType: "withdrawal", targetId: withdrawal.id,
      details: { amount, account_id }, ipAddress: getClientIp(request.headers) }),
  ])

  return NextResponse.json({ data: withdrawal, error: null }, { status: 201 })
}
