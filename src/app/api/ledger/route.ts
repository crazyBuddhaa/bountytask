import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getLiveBalance, getLedgerHistory } from "@/lib/ledger"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100)

  const [balance, { entries, total }] = await Promise.all([
    getLiveBalance(user.id),
    getLedgerHistory(user.id, { page, limit }),
  ])

  return NextResponse.json({
    data: { balance, entries, total, page, limit, hasMore: total > (page - 1) * limit + limit },
    error: null,
  })
}
