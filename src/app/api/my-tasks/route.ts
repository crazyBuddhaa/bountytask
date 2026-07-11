import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page   = parseInt(searchParams.get("page")  ?? "1")
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100)
  const status = searchParams.get("status")
  const from   = (page - 1) * limit

  let query = supabase
    .from("task_completions")
    .select(
      "id, status, proof_url, proof_text, submitted_at, reviewed_at, rejection_reason, created_at, task:tasks(id, title, reward_amount, type)",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1)

  if (status) query = query.eq("status", status)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  return NextResponse.json({
    data:    data ?? [],
    total:   count ?? 0,
    page,
    limit,
    hasMore: (count ?? 0) > from + limit,
    error:   null,
  })
}
