"use client"
import { useState, useEffect } from "react"
import { Users, UserCheck, Clock, Activity } from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { Period } from "./period"
import { shortDate } from "./period"

interface AnalyticsData {
  daily_visitors:            { date: string; count: number }[]
  daily_active_users:        { date: string; count: number }[]
  daily_registered_visits:   { date: string; count: number }[]
  daily_unregistered_visits: { date: string; count: number }[]
  daily_page_views:          { date: string; count: number }[]
  daily_avg_time_seconds:    { date: string; seconds: number }[]
  top_pages:                 { path: string; count: number }[]
  recent_activity:           { path: string; created_at: string; registered: boolean; duration_seconds: number }[]
  summary: {
    total_visitors: number
    total_active_users: number
    total_page_views: number
    avg_time_seconds: number
  }
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m}m ${s}s` : `${m}m`
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function WebsiteAnalytics({ period }: { period: Period }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/analytics?period=${period}`)
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
  }, [period])

  const chartData = data ? data.daily_visitors.map((v, i) => ({
    date:         shortDate(v.date),
    visitors:     v.count,
    registered:   data.daily_registered_visits[i]?.count ?? 0,
    unregistered: data.daily_unregistered_visits[i]?.count ?? 0,
    active_users: data.daily_active_users[i]?.count ?? 0,
    avg_seconds:  data.daily_avg_time_seconds[i]?.seconds ?? 0,
  })) : []

  const summary = data?.summary

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : [
              { label: "Unique Visitors",   value: (summary?.total_visitors ?? 0).toLocaleString(),     icon: Users    },
              { label: "Active Users (DAU)",value: (summary?.total_active_users ?? 0).toLocaleString(), icon: UserCheck },
              { label: "Page Views",        value: (summary?.total_page_views ?? 0).toLocaleString(),   icon: Activity },
              { label: "Avg. Time on Page", value: formatDuration(summary?.avg_time_seconds ?? 0),       icon: Clock    },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">Past {period}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Visitors chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily Visitors & Active Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading
            ? <Skeleton className="h-64 w-full" />
            : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="visitorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="visitors" stroke="hsl(var(--primary))"
                    fill="url(#visitorGrad)" name="Daily Visitors" />
                  <Area type="monotone" dataKey="active_users" stroke="#10b981"
                    fill="url(#dauGrad)" name="Active Users (DAU)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
        </CardContent>
      </Card>

      {/* Registered vs unregistered visits */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registered vs. Unregistered Visits</CardTitle>
        </CardHeader>
        <CardContent>
          {loading
            ? <Skeleton className="h-56 w-full" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="registered" stackId="visits" fill="hsl(var(--primary))" name="Registered" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="unregistered" stackId="visits" fill="#94a3b8" name="Unregistered" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </CardContent>
      </Card>

      {/* Time spent */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Average Time Spent per Visit</CardTitle>
        </CardHeader>
        <CardContent>
          {loading
            ? <Skeleton className="h-56 w-full" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}s`} />
                  <Tooltip formatter={(v: number) => [formatDuration(v), "Avg. time"]} />
                  <Bar dataKey="avg_seconds" fill="#a21caf" name="Avg. seconds" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </CardContent>
      </Card>

      {/* Two columns: top pages + recent activity */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Top pages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Most Visited Pages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : (data?.top_pages ?? []).length === 0
              ? <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
              : (data?.top_pages ?? []).map((p, i) => {
                  const max = data!.top_pages[0].count
                  return (
                    <div key={p.path} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.path}</p>
                        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(p.count / max) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground shrink-0">{p.count}</span>
                    </div>
                  )
                })}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : (data?.recent_activity ?? []).length === 0
              ? <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>
              : (data?.recent_activity ?? []).map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs py-1 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.path}</p>
                      <p className="text-muted-foreground">{timeAgo(a.created_at)} · {formatDuration(a.duration_seconds)}</p>
                    </div>
                    <Badge variant={a.registered ? "default" : "secondary"} className="shrink-0 text-[10px]">
                      {a.registered ? "Registered" : "Guest"}
                    </Badge>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
