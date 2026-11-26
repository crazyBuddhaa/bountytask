"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import {
  Trophy,
  Lock,
  Loader2,
  Coins,
  CheckCircle2,
  ChevronRight,
  Clock,
  AlertCircle,
  Zap,
  Calendar,
  ArrowUpRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GAME_META } from "@/lib/games"
import type { GameSlug } from "@/lib/games"
import type { GameStat } from "@/app/api/games/my-stats/route"
import { formatCurrency } from "@/lib/utils"

interface StatsPayload {
  data: Record<GameSlug, GameStat>
  fees_enabled: boolean
  entry_fees: Record<GameSlug, number>
  balance: number
}

interface PoolPayload {
  total_prize_pool_kobo: number
  by_game: Record<GameSlug, { prize_pool_kobo: number; total_entries: number }>
}

const DAILY_SLUG: GameSlug = "wordle"
const ARCADE_SLUGS: GameSlug[] = [
  "math-sprint",
  "2048",
  "color-rush",
  "word-scramble",
  "tap-target",
]

const GAME_TAGLINE: Record<GameSlug, { duration: string; skill: string }> = {
  "wordle":          { duration: "~2 min",  skill: "Word logic" },
  "math-sprint":     { duration: "45 sec",  skill: "Mental math" },
  "2048":            { duration: "Open",    skill: "Strategy" },
  "color-rush":      { duration: "30 sec",  skill: "Focus & speed" },
  "word-scramble":   { duration: "10 rds",  skill: "Vocabulary" },
  "tap-target":      { duration: "30 sec",  skill: "Reflex" },
  "higher-or-lower": { duration: "~1 min",  skill: "Deduction" },
}

function getMondayResetLabel(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sun, 1 = Mon
  const daysUntilMon = day === 0 ? 1 : 8 - day
  const nextMon = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMon, 0, 0, 0)
  )
  const diffMs = Math.max(0, nextMon.getTime() - now.getTime())
  const days = Math.floor(diffMs / 86_400_000)
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000)
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`
}

export default function GamesPage() {
  const [payload, setPayload] = useState<StatsPayload | null>(null)
  const [pools, setPools] = useState<PoolPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resetIn, setResetIn] = useState<string>("")

  useEffect(() => {
    setResetIn(getMondayResetLabel())
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, poolRes] = await Promise.all([
        fetch("/api/games/my-stats"),
        fetch("/api/games/pools"),
      ])
      if (!statsRes.ok) throw new Error("Failed to load game stats")
      const stats = await statsRes.json()
      setPayload(stats)
      if (poolRes.ok) {
        const poolData = await poolRes.json()
        if (poolData?.data) setPools(poolData.data)
      }
    } catch {
      setError("Could not load games data. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const stats = payload?.data ?? null
  const entryFees = payload?.entry_fees ?? ({} as Record<GameSlug, number>)
  const balance = payload?.balance ?? 0
  const feesOn = payload?.fees_enabled ?? false
  const totalPool = pools?.total_prize_pool_kobo ?? 0

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Skill Arcade
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">Games</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compete on weekly leaderboards. Top 3 players in each game split the pool every Monday.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/games/payouts">My Winnings</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/games/leaderboard">
              <Trophy className="w-3.5 h-3.5" />
              Leaderboard
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5 text-sm text-destructive font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Weekly Prize Pool Summary Strip ────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Weekly Prize Pool
            </p>
            {loading ? (
              <Skeleton className="h-7 w-28 mt-1" />
            ) : (
              <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                {feesOn ? formatCurrency(totalPool) : "Free Play"}
              </p>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Payout Split
            </p>
            <p className="text-sm font-semibold tabular-nums mt-1">
              50% · 30% · 20%
            </p>
            <p className="text-[11px] text-muted-foreground">Top 3 per game</p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Week Resets
            </p>
            <p className="text-sm font-semibold tabular-nums mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              {resetIn || "Monday UTC"}
            </p>
            <p className="text-[11px] text-muted-foreground">Settled Mondays</p>
          </div>

          <div className="sm:text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Wallet Balance
            </p>
            {loading ? (
              <Skeleton className="h-6 w-24 sm:ml-auto mt-1" />
            ) : (
              <p className="text-base font-bold tabular-nums mt-1 inline-flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-primary" />
                {formatCurrency(balance)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Featured Daily Challenge ───────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Daily Challenge
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">One attempt per day</span>
        </div>

        <FeaturedDailyCard
          slug={DAILY_SLUG}
          stat={stats?.[DAILY_SLUG]}
          loading={loading}
          entryFeeKobo={entryFees[DAILY_SLUG] ?? 0}
          poolKobo={pools?.by_game?.[DAILY_SLUG]?.prize_pool_kobo ?? 0}
          entriesCount={pools?.by_game?.[DAILY_SLUG]?.total_entries ?? 0}
          balance={balance}
          feesEnabled={feesOn}
        />
      </section>

      {/* ── Skill Arcade Grid ──────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Skill Arcade
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Unlimited replays · highest score ranks
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ARCADE_SLUGS.map((slug) => (
            <ArcadeGameCard
              key={slug}
              slug={slug}
              stat={stats?.[slug]}
              loading={loading}
              entryFeeKobo={entryFees[slug] ?? 0}
              poolKobo={pools?.by_game?.[slug]?.prize_pool_kobo ?? 0}
              entriesCount={pools?.by_game?.[slug]?.total_entries ?? 0}
              balance={balance}
              feesEnabled={feesOn}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function FeaturedDailyCard({
  slug,
  stat,
  loading,
  entryFeeKobo,
  poolKobo,
  entriesCount,
  balance,
  feesEnabled,
}: {
  slug: GameSlug
  stat?: GameStat
  loading: boolean
  entryFeeKobo: number
  poolKobo: number
  entriesCount: number
  balance: number
  feesEnabled: boolean
}) {
  const router = useRouter()
  const meta = GAME_META[slug]
  const tag = GAME_TAGLINE[slug]
  const alreadyPlayed = Boolean(stat?.completed_today)
  const hasFee = feesEnabled && entryFeeKobo > 0
  const canAfford = balance >= entryFeeKobo
  const [entering, setEntering] = useState(false)

  async function handlePlay() {
    if (!hasFee) {
      router.push(`/dashboard/games/${slug}`)
      return
    }
    if (!canAfford) {
      toast.error(`You need ${formatCurrency(entryFeeKobo)} to play.`)
      return
    }
    setEntering(true)
    try {
      const res = await fetch("/api/games/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_slug: slug }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not enter game")
        return
      }
      const params = new URLSearchParams()
      if (json.entry_id) params.set("entry_id", json.entry_id)
      if (json.fee_kobo) params.set("entry_fee", String(json.fee_kobo))
      router.push(`/dashboard/games/${slug}${params.toString() ? `?${params}` : ""}`)
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setEntering(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
      <div className="flex items-start gap-4 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">
          {meta.emoji}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-foreground">{meta.name}</h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              {tag.duration} · {tag.skill}
            </span>
            {alreadyPlayed && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Played today
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{meta.description}</p>
          <div className="flex items-center gap-4 mt-2.5 text-xs text-muted-foreground tabular-nums flex-wrap">
            {!loading && stat && stat.total_plays > 0 && (
              <span>
                Best: <strong className="text-foreground">{stat.best_score.toLocaleString()}</strong>
              </span>
            )}
            {feesEnabled && poolKobo > 0 && (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                Pool: {formatCurrency(poolKobo)} ({entriesCount} {entriesCount === 1 ? "entry" : "entries"})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0">
        {loading ? (
          <Skeleton className="h-10 w-36" />
        ) : alreadyPlayed ? (
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/dashboard/games/leaderboard">
              View Rankings
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </Button>
        ) : (
          <Button
            onClick={() => void handlePlay()}
            disabled={entering || (hasFee && !canAfford)}
            className="w-full sm:w-auto"
          >
            {entering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : hasFee && !canAfford ? (
              <Lock className="w-4 h-4" />
            ) : null}
            {hasFee ? `Play · ${formatCurrency(entryFeeKobo)}` : "Play Daily Wordle"}
            {!entering && <ChevronRight className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}

function ArcadeGameCard({
  slug,
  stat,
  loading,
  entryFeeKobo,
  poolKobo,
  entriesCount,
  balance,
  feesEnabled,
}: {
  slug: GameSlug
  stat?: GameStat
  loading: boolean
  entryFeeKobo: number
  poolKobo: number
  entriesCount: number
  balance: number
  feesEnabled: boolean
}) {
  const router = useRouter()
  const meta = GAME_META[slug]
  const tag = GAME_TAGLINE[slug]
  const hasFee = feesEnabled && entryFeeKobo > 0
  const canAfford = balance >= entryFeeKobo
  const [entering, setEntering] = useState(false)

  async function handlePlay() {
    if (!hasFee) {
      router.push(`/dashboard/games/${slug}`)
      return
    }
    if (!canAfford) {
      toast.error(`You need ${formatCurrency(entryFeeKobo)} to play.`)
      return
    }
    setEntering(true)
    try {
      const res = await fetch("/api/games/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_slug: slug }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not enter game")
        return
      }
      const params = new URLSearchParams()
      if (json.entry_id) params.set("entry_id", json.entry_id)
      if (json.fee_kobo) params.set("entry_fee", String(json.fee_kobo))
      router.push(`/dashboard/games/${slug}${params.toString() ? `?${params}` : ""}`)
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setEntering(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between gap-4 hover:border-foreground/25 transition-colors">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">
            {meta.emoji}
          </div>
          <div className="flex items-center gap-1.5">
            {meta.isNew && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                New
              </span>
            )}
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              {tag.duration}
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-foreground">{meta.name}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {meta.description}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border tabular-nums">
          {loading ? (
            <Skeleton className="h-3.5 w-24" />
          ) : stat && stat.total_plays > 0 ? (
            <>
              <span>
                Best: <strong className="text-foreground">{stat.best_score.toLocaleString()}</strong>
              </span>
              <span>{stat.total_plays} plays</span>
            </>
          ) : (
            <span>{tag.skill}</span>
          )}
        </div>

        {feesEnabled && poolKobo > 0 && (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            Pool: {formatCurrency(poolKobo)} · {entriesCount}{" "}
            {entriesCount === 1 ? "entry" : "entries"}
          </p>
        )}
      </div>

      <Button
        variant={hasFee && !canAfford ? "outline" : "default"}
        size="sm"
        className="w-full"
        onClick={() => void handlePlay()}
        disabled={loading || entering || (hasFee && !canAfford)}
      >
        {entering ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : hasFee && !canAfford ? (
          <Lock className="w-3.5 h-3.5" />
        ) : null}
        {hasFee
          ? canAfford
            ? `Play · ${formatCurrency(entryFeeKobo)}`
            : `Need ${formatCurrency(entryFeeKobo)}`
          : "Play Free"}
      </Button>
    </div>
  )
}
