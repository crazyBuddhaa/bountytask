import { NextResponse, type NextRequest } from "next/server"
import { confirmAdvertiserPayment } from "@/lib/paystack-confirm"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const verifySchema = z.object({
  submission_id: z.string().uuid(),
  reference: z.string().min(4),
})

/**
 * Public — confirms the advertiser submission fee. This is the client-driven
 * half of confirmation, called when Paystack redirects the browser back
 * after checkout. See /api/webhooks/paystack for the server-to-server half
 * that covers the customer being charged but never making it back to this
 * page (dropped connection, closed tab, etc). Both share
 * confirmAdvertiserPayment, which is idempotent.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const result = await confirmAdvertiserPayment(parsed.data.reference, parsed.data.submission_id)
  if (!result.ok) {
    return NextResponse.json({ data: null, error: result.error }, { status: 402 })
  }

  return NextResponse.json({ data: { paid: true }, error: null })
}
