"use client"
import { useState, useEffect } from "react"
import { BarChart2, TrendingUp, Activity, Wallet } from "lucide-react"
import { toast } from "sonner"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import type { Period } from "./period"
import { shortDate } from "./period"

interface ProfitabilityData {
  task_rewards_kobo: number
  news_rewards_kobo: number
  game_prizes_kobo: number
  signup_bonuses_kobo: number
  referral_bonuses_kobo: number
  other_credits_kobo: number
  total_credits_kobo: number
  advertiser_revenue_kobo: number
  verification_fee_revenue_kobo: number
  game_platform_cut_kobo: number
  est_cpx_margin_kobo: number
  total_recorded_revenue_kobo: number
  net_margin_kobo: number
}

interface ProviderHealth {
  id: string
  name: string
  enabled: boolean
  configured: boolean
  status: "active" | "needs_config" | "disabled"
  completions: number
  payout_kobo: number
  note: string
}

interface ReportData {
  daily_signups:     { date: string; count: number }[]
  daily_completions: { date: string; count: number }[]
  daily_credits:     { date: string; total_kobo: number }[]
  top_tasks:         { task_id: string; title: string; count: number }[]
  withdrawal_volume: { pending_kobo: number; approved_kobo: number; paid_kobo: number }
  profitability?:    ProfitabilityData
  providers?:        ProviderHealth[]
}

function formatSignedCurrency(kobo: number): string {
  if (kobo < 0) return `-${formatCurrency(Math.abs(kobo))}`
  if (kobo > 0) return `+${formatCurrency(kobo)}`
  return formatCurrency(0)
}

function providerStatusBadge(status: ProviderHealth["status"]) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    )
  }
  if (status === "needs_config") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Needs Config
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
      Disabled
    </span>
  )
}

export function PlatformReport({ period }: { period: Period }) {
  const [data, setData]     = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/admin/reports?period=${period}`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? "Failed to load platform report")
        return j
      })
      .then((j) => {
        if (active) setData(j.data ?? null)
      })
      .catch((err) => {
        if (active) toast.error(err instanceof Error ? err.message : "Failed to load platform report")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [period])

  const chartData = (() => {
    if (!data) return []
    const signupsMap = new Map<string, number>(data.daily_signups.map(d => [d.date, d.count]))
    const completionsMap = new Map<string, number>(data.daily_completions.map(d => [d.date, d.count]))
    const creditsMap = new Map<string, number>(data.daily_credits.map(d => [d.date, d.total_kobo]))
    const allDates = Array.from(
      new Set([
        ...data.daily_signups.map(d => d.date),
        ...data.daily_completions.map(d => d.date),
        ...data.daily_credits.map(d => d.date),
      ])
    ).sort()
    return allDates.map(date => ({
      date:        shortDate(date),
      signups:     signupsMap.get(date) ?? 0,
      completions: completionsMap.get(date) ?? 0,
      credits_ngn: Math.round((creditsMap.get(date) ?? 0) / 100),
    }))
  })()

  const totalCredits = data?.daily_credits.reduce((s, d) => s + d.total_kobo, 0) ?? 0
  const totalSignups = data?.daily_signups.reduce((s, d) => s + d.count, 0) ?? 0
  const totalCompletions = data?.daily_completions.reduce((s, d) => s + d.count, 0) ?? 0

  const prof = data?.profitability
  const providers = data?.providers ?? []

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
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">Past {period}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Profitability & Margin Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                Profitability &amp; Margin Overview
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Recorded platform revenue vs. user credits issued over the past {period}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          ) : (
            <>
              {/* 3 Key Financial Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Recorded Revenue</p>
                  <p className="text-xl font-bold tabular-nums mt-1">
                    {formatCurrency(prof?.total_recorded_revenue_kobo ?? 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                    Advertiser {formatCurrency(prof?.advertiser_revenue_kobo ?? 0)} · Game 20%{" "}
                    {formatCurrency(prof?.game_platform_cut_kobo ?? 0)} · Verification{" "}
                    {formatCurrency(prof?.verification_fee_revenue_kobo ?? 0)} · Est. CPX{" "}
                    {formatCurrency(prof?.est_cpx_margin_kobo ?? 0)}
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Total Credits Issued</p>
                  <p className="text-xl font-bold tabular-nums mt-1">
                    {formatCurrency(prof?.total_credits_kobo ?? totalCredits)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                    All user task rewards, news rewards, game prizes &amp; bonuses
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground">Net Platform Margin</p>
                  <p
                    className={`text-xl font-bold tabular-nums mt-1 ${
                      (prof?.net_margin_kobo ?? 0) >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatSignedCurrency(prof?.net_margin_kobo ?? 0)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                    Excludes passive Monetag/Adsterra display revenue tracked in external ad dashboards
                  </p>
                </div>
              </div>

              {/* Payout Breakdown by Stream & Provider Status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payout Breakdown by Stream */}
                <div>
                  <h3 className="text-sm font-semibold mb-2.5">Payout Breakdown by Stream</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Stream</th>
                          <th className="text-right font-medium px-3 py-2">Amount ({period})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[
                          { label: "Tasks",             kobo: prof?.task_rewards_kobo ?? 0 },
                          { label: "News",              kobo: prof?.news_rewards_kobo ?? 0 },
                          { label: "Game Prizes",       kobo: prof?.game_prizes_kobo ?? 0 },
                          { label: "Signup Bonuses",    kobo: prof?.signup_bonuses_kobo ?? 0 },
                          { label: "Referral Bonuses",  kobo: prof?.referral_bonuses_kobo ?? 0 },
                          ...(prof && prof.other_credits_kobo > 0
                            ? [{ label: "Other Credits", kobo: prof.other_credits_kobo }]
                            : []),
                          {
                            label: "Paid Withdrawals (All-Time)",
                            kobo: data?.withdrawal_volume.paid_kobo ?? 0,
                          },
                        ].map((row) => (
                          <tr key={row.label} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-xs sm:text-sm">{row.label}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums text-xs sm:text-sm">
                              {formatCurrency(row.kobo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Provider Status & Activity */}
                <div>
                  <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    Provider Status &amp; Activity
                  </h3>
                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Provider</th>
                          <th className="text-left font-medium px-3 py-2">Status</th>
                          <th className="text-right font-medium px-3 py-2">Completions</th>
                          <th className="text-right font-medium px-3 py-2">Payout</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {providers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                              No provider data available
                            </td>
                          </tr>
                        ) : (
                          providers.map((p) => (
                            <tr key={p.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2">
                                <p className="font-medium text-xs sm:text-sm">{p.name}</p>
                                <p className="text-[11px] text-muted-foreground">{p.note}</p>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {providerStatusBadge(p.status)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs sm:text-sm">
                                {p.completions.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums text-xs sm:text-sm">
                                {formatCurrency(p.payout_kobo)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
