import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLiveBalance, getLedgerHistory } from "@/lib/ledger"
import { getUserTierStatus } from "@/lib/tiers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { TrendingUp, CheckCircle2, Clock, ArrowRight, Zap, ListTodo, Award, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils"
import type { TaskCompletion, LedgerEntry } from "@/types"

function tierBadgeClass(name?: string | null) {
  switch (name?.toLowerCase()) {
    case "bronze":   return "bg-amber-100 text-amber-800 border-amber-200"
    case "silver":   return "bg-slate-100 text-slate-700 border-slate-200"
    case "gold":     return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "platinum": return "bg-cyan-100 text-cyan-800 border-cyan-200"
    case "diamond":  return "bg-blue-100 text-blue-800 border-blue-200"
    case "elite":    return "bg-purple-100 text-purple-800 border-purple-200"
    default:         return "bg-muted text-muted-foreground border-border"
  }
}

export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const admin = createAdminClient()

  const [balance, { entries: recentLedger }, completionsResult, tasksResult, tierStatus] = await Promise.all([
    getLiveBalance(user.id),
    getLedgerHistory(user.id, { page: 1, limit: 5 }),
    admin
      .from("task_completions")
      .select("id, status, task:tasks(title), created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    getUserTierStatus(user.id),
  ])

  const completions = (completionsResult.data ?? []) as unknown as (TaskCompletion & { task: { title: string } })[]
  const approvedCount = completions.filter(c => c.status === "approved").length
  const pendingCount = completions.filter(c => c.status === "pending").length
  const activeTaskCount = tasksResult.count ?? 0

  const stats = [
    {
      label: "Available Balance",
      value: formatCurrency(balance),
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
      href: "/dashboard/earnings",
    },
    {
      label: "Tasks Completed",
      value: approvedCount.toString(),
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      href: "/dashboard/my-tasks",
    },
    {
      label: "Pending Review",
      value: pendingCount.toString(),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: "/dashboard/my-tasks",
    },
    {
      label: "Available Tasks",
      value: activeTaskCount.toString(),
      icon: ListTodo,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/dashboard/tasks",
    },
  ]

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back — here&apos;s your activity at a glance.</p>
      </div>

      {/* Balance hero */}
      <div className="rounded-2xl bounty-gradient p-6 text-white bounty-glow relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm font-medium">Total Balance</p>
            <p className="text-4xl font-bold mt-1">{formatCurrency(balance)}</p>
            <p className="text-white/60 text-xs mt-2">
              Balance is always computed live from your transaction ledger.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
              <Link href="/dashboard/withdrawal">Withdraw</Link>
            </Button>
            <Button asChild size="sm" className="bg-white text-primary hover:bg-white/90">
              <Link href="/dashboard/tasks"><Zap className="w-3.5 h-3.5" />Earn More</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-5">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Tier status card */}
      {tierStatus.currentTier && (
        <Link href="/dashboard/referral" className="block mt-2">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                {/* Left: badge + perks */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${tierBadgeClass(tierStatus.currentTier.name)}`}>
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] border ${tierBadgeClass(tierStatus.currentTier.name)}`}>
                        Tier {tierStatus.currentTier.id} · {tierStatus.currentTier.name}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{tierStatus.currentTier.perks}</p>
                  </div>
                </div>

                {/* Centre: daily limit progress */}
                <div className="hidden sm:block text-center shrink-0">
                  <p className="text-sm font-bold">{tierStatus.tasksCompletedToday}/{tierStatus.dailyLimit}</p>
                  <p className="text-[10px] text-muted-foreground">today (tasks & ads)</p>
                </div>

                {/* Right: next tier nudge */}
                <div className="flex items-center gap-2 shrink-0">
                  {tierStatus.nextTier ? (
                    <p className="text-xs text-muted-foreground hidden md:block">
                      Next: <span className="font-semibold text-foreground">{tierStatus.nextTier.name}</span>
                    </p>
                  ) : (
                    <Badge variant="success" className="text-[10px]">Max Tier</Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              {/* Progress bars — only if there's a next tier */}
              {tierStatus.nextTier && (() => {
                const { nextTier, referralCount, totalCompletions } = tierStatus
                const refPct  = Math.min(100, nextTier.min_referrals  > 0 ? (referralCount   / nextTier.min_referrals)  * 100 : 100)
                const compPct = Math.min(100, nextTier.min_completions > 0 ? (totalCompletions / nextTier.min_completions) * 100 : 100)
                return (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">{referralCount}/{nextTier.min_referrals} referrals</p>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bounty-gradient rounded-full transition-all" style={{ width: `${refPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">{totalCompletions}/{nextTier.min_completions} completions (tasks & ads)</p>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${compPct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/dashboard/earnings">View all <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLedger.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No transactions yet.</p>
            ) : (
              recentLedger.map((entry: LedgerEntry) => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium capitalize">{entry.ref_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(entry.created_at)}</p>
                  </div>
                  <span className={`text-sm font-bold ${entry.delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {entry.delta > 0 ? "+" : ""}{formatCurrency(Math.abs(entry.delta))}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent completions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Submissions</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/dashboard/my-tasks">View all <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {completions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No task submissions yet.</p>
                <Button asChild size="sm" variant="gradient">
                  <Link href="/dashboard/tasks">Browse Tasks</Link>
                </Button>
              </div>
            ) : (
              completions.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.task?.title ?? "Task"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(c.created_at)}</p>
                  </div>
                  <Badge
                    variant={c.status === "approved" ? "success" : c.status === "rejected" ? "destructive" : "pending"}
                    className="ml-2 shrink-0"
                  >
                    {c.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
