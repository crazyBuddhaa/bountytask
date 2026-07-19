"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Trophy, Gamepad2, Lock, Loader2, Coins, CheckCircle2, Star, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GAME_META, GAME_SLUGS } from "@/lib/games"
import type { GameSlug } from "@/lib/games"
import type { GameStat } from "@/app/api/games/my-stats/route"

interface StatsPayload {
  data: Record<GameSlug, GameStat>
  fees_enabled: boolean
  entry_fees: Record<GameSlug, number>
  balance: number
}

const THEME: Record<GameSlug, { bg: string; border: string; iconBg: string; glow: string }> = {
  'wordle':          { bg: 'from-emerald-500/10 to-transparent', border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/15', glow: 'hover:shadow-emerald-500/10' },
  'higher-or-lower': { bg: 'from-blue-500/10 to-transparent',   border: 'border-blue-500/20',   iconBg: 'bg-blue-500/15',   glow: 'hover:shadow-blue-500/10' },
  'tap-target':      { bg: 'from-red-500/10 to-transparent',    border: 'border-red-500/20',    iconBg: 'bg-red-500/15',    glow: 'hover:shadow-red-500/10' },
  '2048':            { bg: 'from-amber-500/10 to-transparent',  border: 'border-amber-500/20',  iconBg: 'bg-amber-500/15',  glow: 'hover:shadow-amber-500/10' },
  'color-rush':      { bg: 'from-violet-500/10 to-transparent', border: 'border-violet-500/20', iconBg: 'bg-violet-500/15', glow: 'hover:shadow-violet-500/10' },
  'word-scramble':   { bg: 'from-pink-500/10 to-transparent',   border: 'border-pink-500/20',   iconBg: 'bg-pink-500/15',   glow: 'hover:shadow-pink-500/10' },
}

const DAILY_SLUGS:  GameSlug[] = ['wordle', 'higher-or-lower']
const ARCADE_SLUGS: GameSlug[] = ['tap-target', '2048', 'color-rush', 'word-scramble']

export default function GamesPage() {
  const [payload, setPayload] = useState<StatsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    fetch("/api/games/my-stats")
      .then(r => r.json())
      .then((j: StatsPayload) => { setPayload(j); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const stats     = payload?.data        ?? null
  const entryFees = payload?.entry_fees  ?? ({} as Record<GameSlug, number>)
  const balance   = payload?.balance     ?? 0
  const feesOn    = payload?.fees_enabled ?? false
  const dailyDone = DAILY_SLUGS.filter(s => stats?.[s]?.completed_today).length

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-primary" />
            Games & Earn
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Play skill-based games and compete on the weekly leaderboard
          </p>
        </div>
        <Link href="/dashboard/games/leaderboard">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            Leaderboard
          </Button>
        </Link>
      </div>

      {/* Prize pool strip */}
      <div className="bounty-gradient p-px rounded-xl">
        <div className="rounded-[calc(0.75rem-1px)] bg-card/90 backdrop-blur-sm px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏆</span>
            <div>
              <p className="font-semibold text-sm">Weekly Prize Pool</p>
              <p className="text-xs text-muted-foreground">
                {feesOn
                  ? "Entry fees fund the pool — top 3 split 80% every Monday"
                  : "Top players win prizes every Monday · Free to play now"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {feesOn && (
              <div className="text-xs font-medium flex items-center gap-1.5 bg-primary/10 text-primary rounded-lg px-3 py-1.5">
                <Coins className="w-3.5 h-3.5" />
                ₦{(balance / 100).toFixed(2)}
              </div>
            )}
            <Link href="/dashboard/games/leaderboard">
              <Button size="sm" className="bounty-gradient text-white border-0 text-xs gap-1">
                View Rankings
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Daily games */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Games</h2>
          </div>
          {!loading && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {dailyDone}/{DAILY_SLUGS.length} played today
            </p>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {DAILY_SLUGS.map((slug, i) => (
            <GameCard
              key={slug}
              slug={slug}
              stat={stats?.[slug]}
              loading={loading}
              entryFeeKobo={entryFees[slug] ?? 0}
              balance={balance}
              feesEnabled={feesOn}
              animIdx={i}
            />
          ))}
        </div>
      </section>

      {/* Arcade games */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arcade Games</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {ARCADE_SLUGS.map((slug, i) => (
            <GameCard
              key={slug}
              slug={slug}
              stat={stats?.[slug]}
              loading={loading}
              entryFeeKobo={entryFees[slug] ?? 0}
              balance={balance}
              feesEnabled={feesOn}
              animIdx={i + 2}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function GameCard({
  slug, stat, loading, entryFeeKobo, balance, feesEnabled, animIdx,
}: {
  slug: GameSlug
  stat?: GameStat
  loading: boolean
  entryFeeKobo: number
  balance: number
  feesEnabled: boolean
  animIdx: number
}) {
  const router = useRouter()
  const meta = GAME_META[slug]
  const theme = THEME[slug]
  const alreadyPlayed = meta.isDaily && stat?.completed_today
  const hasFee = feesEnabled && entryFeeKobo > 0
  const canAfford = balance >= entryFeeKobo
  const [entering, setEntering] = useState(false)
  const hasStats = stat && stat.total_plays > 0

  async function handlePlay() {
    if (!hasFee) { router.push(`/dashboard/games/${slug}`); return }
    if (!canAfford) {
      toast.error(`You need ₦${(entryFeeKobo / 100).toFixed(2)} to play.`)
      return
    }
    setEntering(true)
    try {
      const r = await fetch("/api/games/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_slug: slug }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error ?? "Could not start game"); return }
      const { entry_id, fee_kobo } = j.data as { entry_id: string | null; fee_kobo: number }
      const params = new URLSearchParams()
      if (entry_id) params.set("entry_id", entry_id)
      if (fee_kobo) params.set("entry_fee", fee_kobo.toString())
      router.push(`/dashboard/games/${slug}?${params.toString()}`)
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setEntering(false)
    }
  }

  return (
    <div
      className={`relative rounded-xl border bg-gradient-to-br ${theme.bg} ${theme.border}
        overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${theme.glow}
        animate-slide-up`}
      style={{ animationDelay: `${animIdx * 55}ms`, animationFillMode: "both" }}
    >
      {/* Played-today overlay */}
      {alreadyPlayed && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-1.5">
          <CheckCircle2 className="w-9 h-9 text-emerald-500" />
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Played today</p>
          <p className="text-[10px] text-muted-foreground">Come back tomorrow</p>
        </div>
      )}

      <div className="p-5 flex flex-col gap-4">
        {/* Top: icon + name + badges */}
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-2xl ${theme.iconBg} flex items-center justify-center text-2xl shrink-0`}>
            {meta.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm leading-tight">{meta.name}</h3>
              {meta.isDaily && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0 font-normal">Daily</Badge>
              )}
              {hasFee && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0 border-amber-400 text-amber-600 dark:text-amber-400 gap-0.5 font-normal">
                  <Coins className="w-2.5 h-2.5" />
                  ₦{(entryFeeKobo / 100).toFixed(2)}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{meta.description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 min-h-[18px]">
          {loading ? (
            <Skeleton className="h-3.5 w-28" />
          ) : hasStats ? (
            <>
              <div className="flex items-center gap-1 text-xs">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="font-semibold tabular-nums">{stat!.best_score.toLocaleString()}</span>
                <span className="text-muted-foreground">best</span>
              </div>
              <span className="text-border">·</span>
              <span className="text-xs text-muted-foreground">
                {stat!.total_plays} play{stat!.total_plays !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground/70 italic">No plays yet — be first!</span>
          )}
        </div>

        {/* CTA */}
        {alreadyPlayed ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/60 py-2.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            Come back tomorrow
          </div>
        ) : hasFee && !canAfford ? (
          <div className="flex items-center justify-center rounded-lg bg-destructive/10 py-2.5 text-xs text-destructive font-medium">
            Insufficient balance
          </div>
        ) : (
          <Button
            className="bounty-gradient text-white border-0 w-full font-semibold"
            size="sm"
            disabled={entering}
            onClick={handlePlay}
          >
            {entering
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : hasFee
                ? `Play · ₦${(entryFeeKobo / 100).toFixed(2)}`
                : "Play Now"
            }
          </Button>
        )}
      </div>
    </div>
  )
}
