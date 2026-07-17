"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Trophy, Gamepad2, Lock, Loader2, Coins } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GAME_META, GAME_SLUGS } from "@/lib/games"
import type { GameSlug } from "@/lib/games"
import type { GameStat } from "@/app/api/games/my-stats/route"

const GAME_COLORS: Record<GameSlug, string> = {
  'wordle':          'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  'higher-or-lower': 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  'tap-target':      'from-red-500/20 to-red-600/10 border-red-500/30',
  '2048':            'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  'color-rush':      'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  'word-scramble':   'from-pink-500/20 to-pink-600/10 border-pink-500/30',
}

interface StatsPayload {
  data: Record<GameSlug, GameStat>
  fees_enabled: boolean
  entry_fees: Record<GameSlug, number>
  balance: number
}

export default function GamesPage() {
  const [payload, setPayload] = useState<StatsPayload | null>(null)
  const [loading, setLoading]  = useState(true)

  const refresh = useCallback(() => {
    fetch("/api/games/my-stats")
      .then(r => r.json())
      .then((j: StatsPayload) => { setPayload(j); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const stats      = payload?.data        ?? null
  const entryFees  = payload?.entry_fees  ?? ({} as Record<GameSlug, number>)
  const balance    = payload?.balance     ?? 0
  const feesOn     = payload?.fees_enabled ?? false

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-primary" />
            Games & Earn
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Play skill-based games and compete on the weekly leaderboard
          </p>
        </div>
        <Link href="/dashboard/games/leaderboard">
          <Button variant="outline" size="sm" className="gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Leaderboard
          </Button>
        </Link>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bounty-gradient p-4 text-white flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm">🏆 Weekly Prize Pool</p>
          <p className="text-xs opacity-90 mt-0.5">
            {feesOn
              ? "Entry fees fund the weekly prize pool — top 3 players split 80 % every Monday."
              : "Top players earn prizes every Monday. Entry fees and prize pools are coming soon — for now, play free!"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {feesOn && (
            <div className="bg-white/20 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" />
              Balance: ₦{(balance / 100).toFixed(2)}
            </div>
          )}
          <Link href="/dashboard/games/leaderboard">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 border-0 text-white">
              View Rankings
            </Button>
          </Link>
        </div>
      </div>

      {/* Daily games */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Daily Games</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {(['wordle', 'higher-or-lower'] as GameSlug[]).map(slug => (
            <GameCard
              key={slug}
              slug={slug}
              stat={stats?.[slug]}
              loading={loading}
              entryFeeKobo={entryFees[slug] ?? 0}
              balance={balance}
              feesEnabled={feesOn}
            />
          ))}
        </div>
      </section>

      {/* Arcade games */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Arcade Games</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {(['tap-target', '2048', 'color-rush', 'word-scramble'] as GameSlug[]).map(slug => (
            <GameCard
              key={slug}
              slug={slug}
              stat={stats?.[slug]}
              loading={loading}
              entryFeeKobo={entryFees[slug] ?? 0}
              balance={balance}
              feesEnabled={feesOn}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function GameCard({
  slug, stat, loading, entryFeeKobo, balance, feesEnabled,
}: {
  slug: GameSlug
  stat?: GameStat
  loading: boolean
  entryFeeKobo: number
  balance: number
  feesEnabled: boolean
}) {
  const router = useRouter()
  const meta = GAME_META[slug]
  const alreadyPlayed = meta.isDaily && stat?.completed_today
  const colorClass = GAME_COLORS[slug]
  const hasFee = feesEnabled && entryFeeKobo > 0
  const canAfford = balance >= entryFeeKobo
  const [entering, setEntering] = useState(false)

  async function handlePlay() {
    if (!hasFee) {
      router.push(`/dashboard/games/${slug}`)
      return
    }
    if (!canAfford) {
      toast.error(`You need ₦${(entryFeeKobo / 100).toFixed(2)} to play. Top up your balance first.`)
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
      if (!r.ok) {
        toast.error(j.error ?? "Could not start game")
        return
      }
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
    <div className={`relative rounded-xl border bg-gradient-to-br ${colorClass} p-5 flex flex-col gap-4 transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.emoji}</span>
          <div>
            <h3 className="font-semibold text-sm">{meta.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {meta.isDaily && <Badge variant="secondary" className="text-xs shrink-0">Daily</Badge>}
          {hasFee && (
            <Badge variant="outline" className="text-xs shrink-0 gap-1 border-amber-400 text-amber-600 dark:text-amber-400">
              <Coins className="w-3 h-3" />
              ₦{(entryFeeKobo / 100).toFixed(2)}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {loading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <div className="text-xs text-muted-foreground">
            {stat && stat.total_plays > 0
              ? <span>Best: <span className="font-semibold text-foreground">{stat.best_score}</span> pts · {stat.total_plays} plays</span>
              : <span>No plays yet</span>
            }
          </div>
        )}

        {alreadyPlayed ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-1.5">
            <Lock className="w-3 h-3" />
            Come back tomorrow
          </div>
        ) : hasFee && !canAfford ? (
          <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-1.5">
            Insufficient balance
          </div>
        ) : (
          <Button
            size="sm"
            className="bounty-gradient text-white border-0"
            disabled={entering}
            onClick={handlePlay}
          >
            {entering
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : hasFee ? `Play · ₦${(entryFeeKobo / 100).toFixed(2)}` : "Play Now"
            }
          </Button>
        )}
      </div>
    </div>
  )
}
