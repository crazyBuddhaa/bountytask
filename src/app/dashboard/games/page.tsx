"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Trophy, Gamepad2, Lock } from "lucide-react"
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

export default function GamesPage() {
  const [stats, setStats] = useState<Record<GameSlug, GameStat> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/games/my-stats")
      .then(r => r.json())
      .then(j => { setStats(j.data ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

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
          <p className="font-semibold text-sm">🏆 Weekly Leaderboard</p>
          <p className="text-xs opacity-90 mt-0.5">
            Top players earn prizes every Monday. Entry fees and prize pools coming soon — for now, play free!
          </p>
        </div>
        <Link href="/dashboard/games/leaderboard">
          <Button size="sm" className="bg-white/20 hover:bg-white/30 border-0 text-white shrink-0">
            View Rankings
          </Button>
        </Link>
      </div>

      {/* Daily games */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Daily Games</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {(['wordle', 'higher-or-lower'] as GameSlug[]).map(slug => (
            <GameCard key={slug} slug={slug} stat={stats?.[slug]} loading={loading} />
          ))}
        </div>
      </section>

      {/* Arcade games */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Arcade Games</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {(['tap-target', '2048', 'color-rush', 'word-scramble'] as GameSlug[]).map(slug => (
            <GameCard key={slug} slug={slug} stat={stats?.[slug]} loading={loading} />
          ))}
        </div>
      </section>
    </div>
  )
}

function GameCard({ slug, stat, loading }: { slug: GameSlug; stat?: GameStat; loading: boolean }) {
  const meta = GAME_META[slug]
  const alreadyPlayed = meta.isDaily && stat?.completed_today
  const colorClass = GAME_COLORS[slug]

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
        {meta.isDaily && (
          <Badge variant="secondary" className="text-xs shrink-0">Daily</Badge>
        )}
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
        ) : (
          <Link href={`/dashboard/games/${slug}`}>
            <Button size="sm" className="bounty-gradient text-white border-0">
              Play Now
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
