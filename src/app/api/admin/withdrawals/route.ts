import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { appendLedger } from "@/lib/ledger"
import { notifyWithdrawalUpdate } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"
import { getClientIp } from "@/lib/utils"
import { getActiveAdminRole, parsePagination } from "@/lib/security"
import { z } from "zod"

export const dynamic = 'force-dynamic'

function isUniqueViolation(err: unknown): boolean {
  if (!err) return false
  const code = (err as { code?: string }).code
  if (code === "23505") return true
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("23505") || msg.includes("duplicate key")
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  const { isAdmin } = await getActiveAdminRole(user.id)
  if (!isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { page, limit } = parsePagination(request.nextUrl.searchParams, 20, 100)
  const status = request.nextUrl.searchParams.get("status")
  const from = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from("withdrawals")
    // withdrawals has two FKs to users (user_id, reviewed_by); without an explicit FK hint
    // the embed is ambiguous and PostgREST rejects the query, silently returning no rows.
    .select("*, user:users!withdrawals_user_id_fkey(id,full_name,email), account:withdrawal_accounts(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (status) query = query.eq("status", status)
  const { data, count } = await query

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit, error: null })
}

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "paid", "under_review"]),
  reason: z.string().optional(),
  admin_notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  const { isAdmin } = await getActiveAdminRole(user.id)
  if (!isAdmin) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })

  const { id, status, reason, admin_notes } = parsed.data
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: withdrawal } = await admin
    .from("withdrawals")
    .select("*, user:users!withdrawals_user_id_fkey(id,email,full_name), account:withdrawal_accounts(*)")
    .eq("id", id)
    .single()
  if (!withdrawal) return NextResponse.json({ data: null, error: "Withdrawal not found" }, { status: 404 })

  const updates: Record<string, unknown> = {
    status, reviewed_at: now, reviewed_by: user.id,
    ...(admin_notes ? { admin_notes } : {}),
    ...(status === "paid" ? { paid_at: now } : {}),
    ...(reason ? { rejection_reason: reason } : {}),
  }

  // Conditionally update FIRST so already-rejected or already-paid withdrawals cannot be re-refunded
  const { data, error } = await admin
    .from("withdrawals")
    .update(updates)
    .eq("id", id)
    .in("status", ["pending", "under_review", "approved"])
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json(
      { data: null, error: "Withdrawal has already been finalized and cannot be updated" },
      { status: 409 }
    )
  }

  // Reverse debit only after the conditional update succeeded
  if (status === "rejected") {
    try {
      await appendLedger({
        userId: withdrawal.user_id, type: "credit", delta: withdrawal.amount,
        refType: "withdrawal_reversal", refId: id, note: `Reversal: ${reason ?? "Rejected by admin"}`, createdBy: user.id,
      })
    } catch (err) {
      if (!isUniqueViolation(err)) {
        throw err
      }
    }
    await notifyWithdrawalUpdate(withdrawal.user_id, withdrawal.user.email, withdrawal.amount, "rejected", reason, id)
  } else if (status === "approved" || status === "paid") {
    await notifyWithdrawalUpdate(withdrawal.user_id, withdrawal.user.email, withdrawal.amount, "approved", undefined, id)
  }

  await auditLog({ actorId: user.id, action: `withdrawal.${status}`, targetType: "withdrawal", targetId: id,
    details: { amount: withdrawal.amount, reason }, ipAddress: getClientIp(request.headers) })

  return NextResponse.json({ data, error: null })
}
