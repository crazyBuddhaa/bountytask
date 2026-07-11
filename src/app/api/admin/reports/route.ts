import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

async function assertAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return data && ["admin", "super_admin"].includes(data.role)
}

function periodToDays(period: string): number {
  return period === "7d" ? 7 : period === "90d" ? 90 : 30
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (!await assertAdmin(user.id)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "30d"
  const days = periodToDays(period)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const admin = createAdminClient()

  const [usersResult, completionsResult, ledgerResult, topTasksResult, withdrawalsResult] = await Promise.all([
    admin.from("users").select("created_at").gte("created_at", since).order("created_at"),
    admin.from("task_completions").select("created_at, status").gte("created_at", since),
    admin.from("ledger").select("created_at, delta, type").gte("created_at", since).eq("type", "credit"),
    admin.from("task_completions")
      .select("task_id, task:tasks(title)", { count: "exact" })
      .eq("status", "approved")
      .gte("created_at", since),
    admin.from("withdrawals").select("amount, status"),
  ])

  // Group by date
  const groupByDate = (rows: { created_at: string }[]) => {
    const map: Record<string, number> = {}
    rows.forEach(r => {
      const d = r.created_at.slice(0, 10)
      map[d] = (map[d] ?? 0) + 1
    })
    return Object.entries(map).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
  }

  const daily_signups = groupByDate(usersResult.data ?? [])
  const daily_completions = groupByDate(completionsResult.data ?? [])

  // Daily credits
  const creditMap: Record<string, number> = {}
  ;(ledgerResult.data ?? []).forEach(e => {
    const d = e.created_at.slice(0, 10)
    creditMap[d] = (creditMap[d] ?? 0) + e.delta
  })
  const daily_credits = Object.entries(creditMap).map(([date, total_kobo]) => ({ date, total_kobo })).sort((a, b) => a.date.localeCompare(b.date))

  // Top tasks
  const taskMap: Record<string, { title: string; count: number }> = {}
  ;(topTasksResult.data ?? []).forEach((r: Record<string, unknown>) => {
    const tid = r.task_id as string
    const title = (r.task as Record<string, unknown>)?.title as string ?? "Unknown"
    taskMap[tid] = { title, count: (taskMap[tid]?.count ?? 0) + 1 }
  })
  const top_tasks = Object.entries(taskMap).map(([task_id, v]) => ({ task_id, ...v })).sort((a, b) => b.count - a.count).slice(0, 10)

  // Withdrawal volume
  const wds = withdrawalsResult.data ?? []
  const withdrawal_volume = {
    pending_kobo: wds.filter(w => w.status === "pending").reduce((s, w) => s + w.amount, 0),
    approved_kobo: wds.filter(w => w.status === "approved").reduce((s, w) => s + w.amount, 0),
    paid_kobo: wds.filter(w => w.status === "paid").reduce((s, w) => s + w.amount, 0),
  }

  return NextResponse.json({ data: { daily_signups, daily_completions, daily_credits, top_tasks, withdrawal_volume }, error: null })
}
