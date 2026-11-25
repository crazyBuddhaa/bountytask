import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLiveBalance, getLedgerHistory } from "@/lib/ledger"
import { getUserTierStatus } from "@/lib/tiers"
import { getVerificationSettings } from "@/lib/verification"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  Zap,
  ListTodo,
  Award,
  ChevronRight,
  Target,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils"
import type { TaskCompletion, LedgerEntry } from "@/types"

function tierBadgeClass(name?: string | null) {
  switch (name?.toLowerCase()) {
    case "bronze":   return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
    case "silver":   return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20"
    case "gold":     return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
    case "platinum": return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20"
    case "diamond":  return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
    case "elite":    return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20"
    default:         return "bg-muted text-muted-foreground border-border"
  }
}

export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const admin = createAdminClient()
  const startOfDayUtc = new Date()
  startOfDayUtc.setUTCHours(0, 0, 0, 0)

  const [
    balance,
    { entries: recentLedger },
    recentCompletions,
    approvedCountResult,
    pendingCountResult,
    tasksResult,
    tierStatus,
    verificationSettings,
    userVerificationResult,
    accountCountResult,
    todayTasksResult,
    gameSessionsResult,
    newsReadsResult,
  ] = await Promise.all([
    getLiveBalance(user.id),
    getLedgerHistory(user.id, { page: 1, limit: 5 }),
    admin
      .from("task_completions")
      .select("id, status, task:tasks(title), created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("task_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "approved"),
    admin
      .from("task_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    getUserTierStatus(user.id),
    getVerificationSettings(),
    admin
      .from("users")
      .select("kyc_verified, phone_verified")
      .eq("id", user.id)
      .single(),
    admin
      .from("withdrawal_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    admin
      .from("task_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfDayUtc.toISOString()),
    admin
      .from("game_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    admin
      .from("news_reads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ])

  const completions = (recentCompletions.data ?? []) as unknown as (TaskCompletion & { task: { title: string } })[]
  const approvedCount = approvedCountResult.count ?? 0
  const pendingCount = pendingCountResult.count ?? 0
  const activeTaskCount = tasksResult.count ?? 0
  const todayTasks = todayTasksResult.count ?? 0
  const dailyLimit = tierStatus.dailyLimit
  const accountCount = accountCountResult.count ?? 0
  const kycVerified = !!userVerificationResult.data?.kyc_verified
  const phoneVerified = !!userVerificationResult.data?.phone_verified
  const hasExploredGamesOrNews = (gameSessionsResult.count ?? 0) > 0 || (newsReadsResult.count ?? 0) > 0

  const minWithdrawalKobo = verificationSettings.min_withdrawal_kobo
  const remainingKobo = Math.max(0, minWithdrawalKobo - balance)
  const withdrawalProgressPct = minWithdrawalKobo > 0
    ? Math.min(100, Math.round((balance / minWithdrawalKobo) * 100))
    : 100
  const readyToWithdraw = balance >= minWithdrawalKobo

  const quickStartSteps = [
    {
      label: "Complete your first task",
      done: approvedCount >= 1,
      href: "/dashboard/tasks",
      cta: "Browse tasks",
    },
    {
      label: "Link your Nigerian bank account",
      done: accountCount >= 1,
      href: "/dashboard/withdrawal",
      cta: "Add bank",
    },
    {
      label: "Try Games or News to earn daily",
      done: hasExploredGamesOrNews,
      href: "/dashboard/games",
      cta: "Explore",
    },
  ]
  const quickStartDoneCount = quickStartSteps.filter(s => s.done).length
  const showQuickStart = quickStartDoneCount < quickStartSteps.length

  const verificationEnabled = verificationSettings.fee_enabled || verificationSettings.phone_verification_enabled
  const readinessItems = [
    { label: "Bank Account", done: accountCount >= 1 },
    ...(verificationSettings.phone_verification_enabled
      ? [{ label: "Phone Verification", done: phoneVerified }]
      : []),
    ...(verificationSettings.fee_enabled
      ? [{ label: "Account Verification", done: kycVerified }]
      : []),
    { label: `Min ${formatCurrency(minWithdrawalKobo)}`, done: readyToWithdraw },
  ]
  const needsVerificationStep =
    (verificationSettings.phone_verification_enabled && !phoneVerified) ||
    (verificationSettings.fee_enabled && !kycVerified)
  const showReadinessBanner = verificationEnabled && readinessItems.some(item => !item.done)

  const stats = [
    {
      label: "Today's Tasks",
      value: dailyLimit > 0 ? `${todayTasks}/${dailyLimit}` : `${todayTasks} today`,
      icon: Target,
      color: "text-primary",
      bg: "bg-primary/10",
      href: "/dashboard/tasks",
    },
    {
      label: "Tasks Completed",
      value: approvedCount.toString(),
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      href: "/dashboard/my-tasks",
    },
    {
      label: "Pending Review",
      value: pendingCount.toString(),
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      href: "/dashboard/my-tasks",
    },
    {
      label: "Available Tasks",
      value: activeTaskCount.toString(),
      icon: ListTodo,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
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
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-white/75 text-sm font-medium">Total Balance</p>
              <p className="text-4xl font-bold mt-1 tabular-nums">{formatCurrency(balance)}</p>
              <p className="text-white/75 text-xs mt-2">
                Paid via Nigerian bank transfer · Verified by Paystack · Processed within 24h
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

          {/* Embedded Next Withdrawal Progress */}
          <div className="rounded-xl bg-white/10 border border-white/15 p-3.5 space-y-2 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-white/90">Next Withdrawal Progress</span>
              <span className="font-semibold text-white tabular-nums">{withdrawalProgressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${readyToWithdraw ? "bg-emerald-300" : "bg-white"}`}
                style={{ width: `${withdrawalProgressPct}%` }}
              />
            </div>
            <p className="text-xs text-white/85 tabular-nums">
              {readyToWithdraw ? (
                "Ready to withdraw! You've reached the minimum threshold."
              ) : (
                <>
                  {formatCurrency(balance)} / {formatCurrency(minWithdrawalKobo)} —{" "}
                  <span className="font-semibold text-white">{formatCurrency(remainingKobo)}</span> away from cashing out
                </>
              )}
            </p>
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
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* New-user Quick Start Checklist */}
      {showQuickStart && (
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Quick Start Checklist</CardTitle>
                <p className="text-xs text-muted-foreground">Complete these steps to start earning and cashing out.</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs tabular-nums">
              {quickStartDoneCount}/{quickStartSteps.length} done
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickStartSteps.map((step) => (
              <Link
                key={step.label}
                href={step.href}
                className="flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm ${step.done ? "line-through text-muted-foreground" : "font-medium"}`}>
                    {step.label}
                  </span>
                </div>
                {!step.done && (
                  <span className="text-xs font-medium text-primary flex items-center gap-1 shrink-0">
                    {step.cta} <ArrowRight className="w-3 h-3" />
                  </span>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upfront Withdrawal Readiness Banner */}
      {showReadinessBanner && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm font-semibold">Withdrawal Readiness</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {readinessItems.map((item) => (
                  <span
                    key={item.label}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border tabular-nums ${
                      item.done
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                    }`}
                  >
                    {item.done ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 gap-1 border-amber-500/30 hover:bg-amber-500/10">
              <Link href={needsVerificationStep ? "/dashboard/verify" : "/dashboard/withdrawal"}>
                {needsVerificationStep ? "Complete Verification" : "Manage Withdrawal"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tier status card */}
      {tierStatus.currentTier && (
        <Link href="/dashboard/tasks" className="block mt-2">
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
                      <Badge className={`text-[10px] border tabular-nums ${tierBadgeClass(tierStatus.currentTier.name)}`}>
                        Tier {tierStatus.currentTier.id} · {tierStatus.currentTier.name}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Complete tasks to unlock higher daily limits
                    </p>
                  </div>
                </div>

                {/* Centre: daily limit progress */}
                <div className="hidden sm:block text-center shrink-0">
                  <p className="text-sm font-bold tabular-nums">{tierStatus.tasksCompletedToday}/{tierStatus.dailyLimit}</p>
                  <p className="text-[10px] text-muted-foreground">today (tasks &amp; ads)</p>
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
                      <p className="text-[10px] text-muted-foreground mb-1 tabular-nums">{referralCount}/{nextTier.min_referrals} referrals</p>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bounty-gradient rounded-full transition-all" style={{ width: `${refPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1 tabular-nums">{totalCompletions}/{nextTier.min_completions} completions (tasks &amp; ads)</p>
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
                  <span className={`text-sm font-bold tabular-nums ${entry.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {entry.delta > 0 ? "+" : "-"}{formatCurrency(Math.abs(entry.delta))}
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
