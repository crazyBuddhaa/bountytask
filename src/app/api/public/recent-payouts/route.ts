import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const revalidate = 300

export interface PublicPayoutItem {
  id: string
  displayName: string
  bankName: string
  amountKobo: number
  paidAt: string
}

interface RawWithdrawalRow {
  id: string
  amount: number
  paid_at: string | null
  created_at: string
  user: { full_name: string | null } | { full_name: string | null }[] | null
  account: { bank_name: string | null } | { bank_name: string | null }[] | null
}

function anonymizeName(fullName: string | null | undefined): string {
  if (!fullName) return "Verified Earner"
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "Verified Earner"

  const rawFirst = parts[0]
  const first = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase()

  if (parts.length === 1) {
    return first.length >= 2 ? first : "Verified Earner"
  }

  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase()
  return `${first} ${lastInitial}.`
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function GET() {
  try {
    const admin = createAdminClient()

    const { data, error } = await admin
      .from("withdrawals")
      .select(
        "id, amount, paid_at, created_at, user:users!withdrawals_user_id_fkey(full_name), account:withdrawal_accounts(bank_name)"
      )
      .eq("status", "paid")
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(6)

    if (error) {
      return NextResponse.json({ payouts: [] }, { status: 500 })
    }

    const rows = (data ?? []) as RawWithdrawalRow[]
    const payouts: PublicPayoutItem[] = rows.map((row) => {
      const user = firstRelation(row.user)
      const account = firstRelation(row.account)

      return {
        id: row.id,
        displayName: anonymizeName(user?.full_name),
        bankName: account?.bank_name?.trim() || "Nigerian Bank",
        amountKobo: Number(row.amount) || 0,
        paidAt: row.paid_at ?? row.created_at,
      }
    })

    return NextResponse.json(
      { payouts },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    )
  } catch {
    return NextResponse.json({ payouts: [] }, { status: 500 })
  }
}
