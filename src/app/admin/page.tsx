"use client"
import { useEffect, useState } from "react"
import { Users, ListTodo, ClipboardCheck, Banknote, TrendingUp, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

interface Stats {
  total_users: number
  active_users: number
  total_tasks: number
  active_tasks: number
  total_completions: number
  pending_completions: number
  total_withdrawn_kobo: number
  pending_withdrawals_kobo: number
  total_fraud_flags: number
  total_ledger_credits_kobo: number
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(j => { setStats(j.data); setLoading(false) })
  }, [])

  const cards = stats ? [
    { icon: Users,         label: "Total Users",          value: stats.total_users.toLocaleString(),          sub: `${stats.active_users.toLocaleString()} active`          },
    { icon: ListTodo,      label: "Total Tasks",          value: stats.total_tasks.toLocaleString(),           sub: `${stats.active_tasks.toLocaleString()} active`          },
    { icon: ClipboardCheck,label: "Completions",          value: stats.total_completions.toLocaleString(),     sub: `${stats.pending_completions.toLocaleString()} pending`  },
    { icon: Banknote,      label: "Withdrawn",            value: formatCurrency(stats.total_withdrawn_kobo),   sub: `${formatCurrency(stats.pending_withdrawals_kobo)} pending` },
    { icon: TrendingUp,    label: "Total Credits Issued", value: formatCurrency(stats.total_ledger_credits_kobo), sub: "all time"                                           },
    { icon: Shield,        label: "Open Fraud Flags",     value: stats.total_fraud_flags.toLocaleString(),     sub: "unresolved"                                             },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform-wide statistics from get_platform_stats().</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : cards.map(({ icon: Icon, label, value, sub }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground font-medium">{label}</p>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  )
}
