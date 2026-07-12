"use client"
import { useState, useEffect } from "react"
import { BarChart2, TrendingUp } from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import type { Period } from "./period"
import { shortDate } from "./period"

interface ReportData {
  daily_signups:     { date: string; count: number }[]
  daily_completions: { date: string; count: number }[]
  daily_credits:     { date: string; total_kobo: number }[]
  top_tasks:         { task_id: string; title: string; count: number }[]
  withdrawal_volume: { pending_kobo: number; approved_kobo: number; paid_kobo: number }
}

export function PlatformReport({ period }: { period: Period }) {
  const [data, setData]     = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/reports?period=${period}`)
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
  }, [period])

  const chartData = data ? data.daily_signups.map((s, i) => ({
    date:        shortDate(s.date),
    signups:     s.count,
    completions: data.daily_completions[i]?.count ?? 0,
    credits_ngn: Math.round((data.daily_credits[i]?.total_kobo ?? 0) / 100),
  })) : []

  const totalCredits = data?.daily_credits.reduce((s, d) => s + d.total_kobo, 0) ?? 0
  const totalSignups = data?.daily_signups.reduce((s, d) => s + d.count, 0) ?? 0
  const totalCompletions = data?.daily_completions.reduce((s, d) => s + d.count, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : [
              { label: "New Users",       value: totalSignups.toLocaleString(),           icon: TrendingUp },
              { label: "Task Completions",value: totalCompletions.toLocaleString(),        icon: BarChart2  },
              { label: "Credits Issued",  value: formatCurrency(totalCredits),            icon: TrendingUp },
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

      {/* Signups & Completions chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Signups vs Completions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading
            ? <Skeleton className="h-64 w-full" />
            : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="signups" stroke="hsl(var(--primary))"
                    fill="url(#signupGrad)" name="Signups" />
                  <Area type="monotone" dataKey="completions" stroke="#10b981"
                    fill="url(#compGrad)" name="Completions" />
                </AreaChart>
              </ResponsiveContainer>
            )}
        </CardContent>
      </Card>

      {/* Credits chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily Credits Issued (₦)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading
            ? <Skeleton className="h-56 w-full" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₦${v.toLocaleString()}`} />
                  <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, "Credits"]} />
                  <Bar dataKey="credits_ngn" fill="hsl(var(--primary))" name="Credits (₦)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </CardContent>
      </Card>

      {/* Two columns: top tasks + withdrawal volume */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Top tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Tasks by Completions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
              : (data?.top_tasks ?? []).length === 0
              ? <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
              : (data?.top_tasks ?? []).map((t, i) => {
                  const max = data!.top_tasks[0].count
                  return (
                    <div key={t.task_id} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{t.title}</p>
                        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(t.count / max) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground shrink-0">{t.count}</span>
                    </div>
                  )
                })}
          </CardContent>
        </Card>

        {/* Withdrawal volume */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Withdrawal Volume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              : [
                  { label: "Pending",  kobo: data?.withdrawal_volume.pending_kobo  ?? 0, color: "bg-amber-500"   },
                  { label: "Approved", kobo: data?.withdrawal_volume.approved_kobo ?? 0, color: "bg-blue-500"    },
                  { label: "Paid Out", kobo: data?.withdrawal_volume.paid_kobo     ?? 0, color: "bg-emerald-500" },
                ].map(({ label, kobo, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      <span className="text-sm">{label}</span>
                    </div>
                    <span className="font-bold text-sm">{formatCurrency(kobo)}</span>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
