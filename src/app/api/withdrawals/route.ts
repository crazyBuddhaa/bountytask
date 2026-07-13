import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendLedger } from "@/lib/ledger"
import { createNotification } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { needsWithdrawalVerification, needsPhoneVerification, getMinWithdrawalKobo } from "@/lib/verification"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.number().int(),
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

  const minWithdrawal = await getMinWithdrawalKobo()
  if (amount < minWithdrawal) {
    return NextResponse.json(
      { data: null, error: `Minimum withdrawal is ₦${(minWithdrawal / 100).toLocaleString("en-NG")}` },
      { status: 400 }
    )
  }

  // One-time verification fee gate — checked here, not at signup.
  if (await needsWithdrawalVerification(user.id)) {
    return NextResponse.json(
      { data: null, error: "Complete verification before withdrawing.", code: "VERIFICATION_REQUIRED" },
      { status: 403 }
    )
  }

  // Phone verification gate — also checked here, not at signup.
  if (await needsPhoneVerification(user.id)) {
    return NextResponse.json(
      { data: null, error: "Verify your phone number before withdrawing.", code: "PHONE_VERIFICATION_REQUIRED" },
      { status: 403 }
    )
  }

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

  // Atomic balance check + debit via DB-level advisory lock.
  // Replaces the old check-then-act pattern (assertSufficientBalance → appendLedger)
  // which was vulnerable to overdrafts under concurrent requests.
  const { data: debitRows, error: debitErr } = await admin.rpc("safe_withdrawal_debit", {
    p_user_id: user.id,
    p_amount:  amount,
    p_note:    `Withdrawal to ${account.bank_name} ${account.account_number}`,
  })
  if (debitErr) return NextResponse.json({ data: null, error: debitErr.message }, { status: 500 })
  const debitResult = debitRows?.[0]
  if (!debitResult?.ok) {
    return NextResponse.json({ data: null, error: debitResult?.err ?? "Insufficient balance" }, { status: 400 })
  }

  // Create withdrawal record linked to the ledger entry created above
  const { data: withdrawal, error } = await admin
    .from("withdrawals")
    .insert({ user_id: user.id, account_id, amount, status: "pending", ledger_entry_id: debitResult.ledger_id })
    .select("*, account:withdrawal_accounts(*)")
    .single()

  if (error) {
    // If withdrawal insert fails (e.g. unique constraint — concurrent request won), the
    // ledger debit is already written. Log but return a clear error; the debit will need
    // manual reversal via admin adjustment if this path is ever hit in practice.
    console.error("Withdrawal insert failed after debit:", error.message, "ledger_id:", debitResult.ledger_id)
    return NextResponse.json({ data: null, error: "Failed to record withdrawal. Contact support." }, { status: 500 })
  }

  await Promise.all([
    createNotification({ userId: user.id, type: "general", title: "Withdrawal Requested",
      message: `Your withdrawal of ₦${(amount / 100).toFixed(2)} is under review.`, refId: withdrawal.id }),
    auditLog({ actorId: user.id, action: "withdrawal.request", targetType: "withdrawal", targetId: withdrawal.id,
      details: { amount, account_id }, ipAddress: getClientIp(request.headers) }),
  ])

  return NextResponse.json({ data: withdrawal, error: null }, { status: 201 })
}
