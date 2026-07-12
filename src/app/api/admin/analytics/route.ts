import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

async function assertAdmin(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).single()
  return data && ["admin", "super_admin"].includes(data.role)
}

function periodToDays(period: string): number {
  return period === "7d" ? 7 : period === "90d" ? 90 : 30
}

type ViewRow = {
  visitor_id: string
  user_id: string | null
  path: string
  duration_seconds: number
  created_at: string
}

const PAGE_SIZE = 1000
const MAX_PAGES = 30 // safety cap: 30k rows per request

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

  const rows: ViewRow[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await admin
      .from("analytics_page_views")
      .select("visitor_id, user_id, path, duration_seconds, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  type DayBucket = {
    visitors: Set<string>
    registeredUsers: Set<string>
    registeredViews: number
    unregisteredViews: number
    views: number
    durationTotal: number
    durationCount: number
  }
  const byDay: Record<string, DayBucket> = {}
  const overallPaths: Record<string, number> = {}
  const allVisitors = new Set<string>()
  const allActiveUsers = new Set<string>()

  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    if (!byDay[day]) {
      byDay[day] = {
        visitors: new Set(), registeredUsers: new Set(),
        registeredViews: 0, unregisteredViews: 0, views: 0,
        durationTotal: 0, durationCount: 0,
      }
    }
    const bucket = byDay[day]
    bucket.visitors.add(r.visitor_id)
    allVisitors.add(r.visitor_id)
    if (r.user_id) {
      bucket.registeredUsers.add(r.user_id)
      bucket.registeredViews += 1
      allActiveUsers.add(r.user_id)
    } else {
      bucket.unregisteredViews += 1
    }
    bucket.views += 1
    if (r.duration_seconds > 0) {
      bucket.durationTotal += r.duration_seconds
      bucket.durationCount += 1
    }
    overallPaths[r.path] = (overallPaths[r.path] ?? 0) + 1
  }

  const dates = Object.keys(byDay).sort()
  const daily_visitors            = dates.map(date => ({ date, count: byDay[date].visitors.size }))
  const daily_active_users        = dates.map(date => ({ date, count: byDay[date].registeredUsers.size }))
  const daily_registered_visits   = dates.map(date => ({ date, count: byDay[date].registeredViews }))
  const daily_unregistered_visits = dates.map(date => ({ date, count: byDay[date].unregisteredViews }))
  const daily_page_views          = dates.map(date => ({ date, count: byDay[date].views }))
  const daily_avg_time_seconds    = dates.map(date => {
    const b = byDay[date]
    return { date, seconds: b.durationCount ? Math.round(b.durationTotal / b.durationCount) : 0 }
  })

  const top_pages = Object.entries(overallPaths)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const recent_activity = rows.slice(-30).reverse().map(r => ({
    path: r.path,
    created_at: r.created_at,
    registered: !!r.user_id,
    duration_seconds: r.duration_seconds,
  }))

  const durationRows = rows.filter(r => r.duration_seconds > 0)
  const summary = {
    total_visitors: allVisitors.size,
    total_active_users: allActiveUsers.size,
    total_page_views: rows.length,
    avg_time_seconds: durationRows.length
      ? Math.round(durationRows.reduce((s, r) => s + r.duration_seconds, 0) / durationRows.length)
      : 0,
  }

  return NextResponse.json({
    data: {
      daily_visitors,
      daily_active_users,
      daily_registered_visits,
      daily_unregistered_visits,
      daily_page_views,
      daily_avg_time_seconds,
      top_pages,
      recent_activity,
      summary,
    },
    error: null,
  })
}
