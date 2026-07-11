import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = createAdminClient()
    const { data: rows } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "verification_fee_enabled",
        "verification_fee_amount",
        "verification_payment_method",
        "bank_transfer_name",
        "bank_transfer_number",
        "bank_transfer_bank",
      ])

    const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]))

    return NextResponse.json({
      data: {
        fee_enabled:       s.verification_fee_enabled       ?? false,
        fee_amount:        s.verification_fee_amount         ?? 50000,
        payment_method:    s.verification_payment_method     ?? "paystack",
        bank_name:         s.bank_transfer_bank              ?? "",
        bank_number:       s.bank_transfer_number            ?? "",
        bank_account_name: s.bank_transfer_name              ?? "",
      },
      error: null,
    })
  } catch {
    return NextResponse.json({ data: null, error: "Settings unavailable" }, { status: 500 })
  }
}
