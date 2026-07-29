"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import { Trophy, Gamepad2, Lock, Loader2, Coins, CheckCircle2, Star, ChevronRight, TrendingUp, Zap, Calendar } from "lucide-react"
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

interface PoolPayload {
  total_prize_pool_kobo: number
  by_game: Record<GameSlug, { prize_pool_kobo: number; total_entries: number }>
}

const THEME: Record<GameSlug, {
  accent: string
  accentBg: string
  glowColor: string
  border: string
  badgeClass: string
}> = {
  'wordle':          { accent: 'text-emerald-400', accentBg: 'bg-emerald-500', glowColor: 'hover:shadow-emerald-500/25', border: 'border-emerald-500/30', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  'higher-or-lower': { accent: 'text-blue-400',    accentBg: 'bg-blue-500',    glowColor: 'hover:shadow-blue-500/25',   border: 'border-blue-500/30',   badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  'tap-target':      { accent: 'text-red-400',     accentBg: 'bg-red-500',     glowColor: 'hover:shadow-red-500/25',    border: 'border-red-500/30',    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/30' },
  '2048':            { accent: 'text-amber-400',   accentBg: 'bg-amber-500',   glowColor: 'hover:shadow-amber-500/25',  border: 'border-amber-500/30',  badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  'color-rush':      { accent: 'text-violet-400',  accentBg: 'bg-violet-500',  glowColor: 'hover:shadow-violet-500/25', border: 'border-violet-500/30', badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  'word-scramble':   { accent: 'text-pink-400',    accentBg: 'bg-pink-500',    glowColor: 'hover:shadow-pink-500/25',   border: 'border-pink-500/30',   badgeClass: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
}

const DAILY_SLUGS:  GameSlug[] = ['wordle', 'higher-or-lower']
const ARCADE_SLUGS: GameSlug[] = ['tap-target', '2048', 'color-rush', 'word-scramble']

export default function GamesPage() {
  const [payload, setPayload] = useState<StatsPayload | null>(null)
  const [pools, setPools]     = useState<PoolPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    Promise.all([
      fetch("/api/games/my-stats").then(r => r.json()),
      fetch("/api/games/pools").then(r => r.json()),
    ]).then(([stats, poolData]) => {
      setPayload(stats)
      if (poolData?.data) setPools(poolData.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const stats      = payload?.data        ?? null
  const entryFees  = payload?.entry_fees  ?? ({} as Record<GameSlug, number>)
  const balance    = payload?.balance     ?? 0
  const feesOn     = payload?.fees_enabled ?? false
  const dailyDone  = DAILY_SLUGS.filter(s => stats?.[s]?.completed_today).length
  const totalPool  = pools?.total_prize_pool_kobo ?? 0

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2.5 tracking-tight">
            <Gamepad2 className="w-7 h-7 text-primary" />
            <span className="bounty-text-gradient">Games & Earn</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Play skill-based games · climb the leaderboard · win prizes
          </p>
        </div>
        <Link href="/dashboard/games/leaderboard">
          <Button variant="outline" size="sm" className="gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
            <Trophy className="w-4 h-4" />
            Leaderboard
          </Button>
        </Link>
      </div>

      {/* ── Prize pool banner ──────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bounty-gradient p-px">
        <div className="relative rounded-[calc(1rem-1px)] bg-card/95 backdrop-blur-sm px-6 py-5 overflow-hidden">
          {/* Decorative glow blob */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bounty-gradient flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-base">Weekly Prize Pool</p>
                {feesOn ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {loading ? (
                      <Skeleton className="h-3 w-32" />
                    ) : totalPool > 0 ? (
                      <>
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-sm font-black text-emerald-500 tabular-nums">
                          ₦{(totalPool / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-muted-foreground">accumulated · top 3 win 80% Monday</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No entries yet — be the first!</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Top players win prizes every Monday · Free to play now</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {feesOn && (
                <div className="text-sm font-bold flex items-center gap-1.5 bg-primary/10 text-primary rounded-xl px-3.5 py-2 tabular-nums border border-primary/20">
                  <Coins className="w-4 h-4" />
                  ₦{(balance / 100).toFixed(2)}
                </div>
              )}
              <Link href="/dashboard/games/leaderboard">
                <Button size="sm" className="bounty-gradient text-white border-0 gap-1.5 shadow-lg shadow-primary/30">
                  View Rankings
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Daily games ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-lg px-3 py-1.5 border border-primary/20">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider">Daily Games</span>
            </div>
            <span className="text-xs text-muted-foreground">One play per day</span>
          </div>
          {!loading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${dailyDone === DAILY_SLUGS.length ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {dailyDone}/{DAILY_SLUGS.length} played today
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
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

      {/* ── Arcade games ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg px-3 py-1.5 border border-amber-500/20">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-xs font-bold uppercase tracking-wider">Arcade Games</span>
          </div>
          <span className="text-xs text-muted-foreground">Unlimited replays</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
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
  const meta   = GAME_META[slug]
  const theme  = THEME[slug]
  const alreadyPlayed = meta.isDaily && stat?.completed_today
  const hasFee   = feesEnabled && entryFeeKobo > 0
  const canAfford = balance >= entryFeeKobo
  const [entering, setEntering] = useState(false)
  const hasStats  = stat && stat.total_plays > 0

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
      className={`group relative rounded-2xl overflow-hidden border ${theme.border} bg-card transition-all duration-300
        hover:-translate-y-1 hover:shadow-xl ${theme.glowColor} animate-slide-up cursor-pointer`}
      style={{ animationDelay: `${animIdx * 60}ms`, animationFillMode: "both" }}
    >
      {/* ── Cover image area ─────────────────────────────────── */}
      <div className="relative h-44 overflow-hidden">
        <Image
          src={`/games/${slug}.jpg`}
          alt={meta.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, 50vw"
          priority={animIdx < 2}
        />
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {meta.isDaily && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badgeClass}`}>
              <Calendar className="w-2.5 h-2.5" />
              Daily
            </span>
          )}
          {hasFee && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Coins className="w-2.5 h-2.5" />
              ₦{(entryFeeKobo / 100).toFixed(2)}
            </span>
          )}
        </div>

        {/* Already-played overlay */}
        {alreadyPlayed && (
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-xs font-bold text-emerald-300">Played today</p>
            <p className="text-[10px] text-white/60">Come back tomorrow</p>
          </div>
        )}

        {/* Game name floating over image */}
        {!alreadyPlayed && (
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="font-black text-white text-lg leading-tight drop-shadow-md">{meta.name}</h3>
          </div>
        )}
      </div>

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground leading-snug">{meta.description}</p>

        {/* Stats row */}
        <div className="flex items-center gap-3 min-h-[16px]">
          {loading ? (
            <Skeleton className="h-3.5 w-28" />
          ) : hasStats ? (
            <>
              <div className="flex items-center gap-1 text-xs">
                <Star className={`w-3 h-3 fill-current ${theme.accent}`} />
                <span className="font-bold tabular-nums">{stat!.best_score.toLocaleString()}</span>
                <span className="text-muted-foreground">best</span>
              </div>
              <span className="text-border">·</span>
              <span className="text-xs text-muted-foreground">
                {stat!.total_plays} play{stat!.total_plays !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground/60 italic">No plays yet</span>
          )}
        </div>

        {/* CTA */}
        {alreadyPlayed ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/60 py-2.5 text-xs text-muted-foreground font-medium">
            <Lock className="w-3.5 h-3.5" />
            Come back tomorrow
          </div>
        ) : hasFee && !canAfford ? (
          <div className="flex items-center justify-center rounded-xl bg-destructive/10 py-2.5 text-xs text-destructive font-bold border border-destructive/20">
            Insufficient balance
          </div>
        ) : (
          <Button
            className="w-full bounty-gradient text-white border-0 font-bold shadow-md shadow-primary/20 transition-all group-hover:shadow-lg group-hover:shadow-primary/30"
            size="sm"
            disabled={entering}
            onClick={handlePlay}
          >
            {entering
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : hasFee
                ? `Play · ₦${(entryFeeKobo / 100).toFixed(2)}`
                : "Play Now →"
            }
          </Button>
        )}
      </div>
    </div>
  )
}
