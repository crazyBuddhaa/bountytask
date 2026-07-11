import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAccount } from "@/lib/paystack"
import { z } from "zod"

const schema = z.object({
  account_number: z.string().length(10),
  bank_code: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.errors[0].message }, { status: 400 })

  try {
    const result = await resolveAccount(parsed.data.account_number, parsed.data.bank_code)
    return NextResponse.json({ data: result, error: null })
  } catch (e: unknown) {
    return NextResponse.json({ data: null, error: (e as Error).message }, { status: 422 })
  }
}
