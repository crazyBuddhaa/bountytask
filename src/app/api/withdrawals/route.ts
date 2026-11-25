import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createNotification } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { needsWithdrawalVerification, needsPhoneVerification, getMinWithdrawalKobo } from "@/lib/verification"
import { parsePagination } from "@/lib/security"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.number().int().positive(),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { page, limit } = parsePagination(request.nextUrl.searchParams, 20, 50)
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

  const body = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })

  const { account_id, amount } = parsed.data
  const admin = createAdminClient()

  // Reject deactivated / suspended users
  const { data: userProfile } = await admin
    .from("users")
    .select("is_active")
    .eq("id", user.id)
    .single()
  if (!userProfile?.is_active) {
    return NextResponse.json({ data: null, error: "Your account is deactivated." }, { status: 403 })
  }

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

  // Atomic pending-check + FOR UPDATE balance debit + withdrawal insert in one DB transaction
  const { data: rpcRows, error: rpcErr } = await admin.rpc("safe_withdrawal_request", {
    p_user_id: user.id,
    p_account_id: account_id,
    p_amount: amount,
    p_note: `Withdrawal to ${account.bank_name} ${account.account_number}`,
  })
  if (rpcErr) return NextResponse.json({ data: null, error: rpcErr.message }, { status: 500 })

  const rpcResult = rpcRows?.[0] as
    | { ok: boolean; withdrawal_id: string | null; ledger_id: string | null; err: string | null; err_code: string | null }
    | undefined

  if (!rpcResult?.ok || !rpcResult.withdrawal_id) {
    const status =
      rpcResult?.err_code === "pending_exists"
        ? 409
        : rpcResult?.err_code === "not_found"
          ? 404
          : 400
    return NextResponse.json({ data: null, error: rpcResult?.err ?? "Withdrawal request failed" }, { status })
  }

  const { data: withdrawal } = await admin
    .from("withdrawals")
    .select("*, account:withdrawal_accounts(*)")
    .eq("id", rpcResult.withdrawal_id)
    .single()

  const responseWithdrawal = withdrawal ?? {
    id: rpcResult.withdrawal_id,
    user_id: user.id,
    account_id,
    amount,
    status: "pending",
    ledger_entry_id: rpcResult.ledger_id,
    account,
  }

  await Promise.all([
    createNotification({ userId: user.id, type: "general", title: "Withdrawal Requested",
      message: `Your withdrawal of ₦${(amount / 100).toFixed(2)} is under review.`, refId: responseWithdrawal.id }),
    auditLog({ actorId: user.id, action: "withdrawal.request", targetType: "withdrawal", targetId: responseWithdrawal.id,
      details: { amount, account_id }, ipAddress: getClientIp(request.headers) }),
  ])

  return NextResponse.json({ data: responseWithdrawal, error: null }, { status: 201 })
}
