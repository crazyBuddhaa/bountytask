"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Trophy, Coins, ArrowLeft, Loader2, Calendar,
  Star, TrendingUp, Gamepad2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import type { Payout } from "@/app/api/games/my-payouts/route"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
}

function weekLabel(start: string) {
  const d   = new Date(`${start}T00:00:00Z`)
  const end = new Date(d)
  end.setUTCDate(d.getUTCDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" }
  return `${d.toLocaleDateString("en-NG", opts)} – ${end.toLocaleDateString("en-NG", { ...opts, year: "numeric" })}`
}

const RANK_ICON: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" }

const GAME_NAMES: Record<string, string> = {
  "wordle":          "Daily Wordle",
  "higher-or-lower": "Higher or Lower",
  "tap-target":      "Tap the Target",
  "2048":            "2048",
  "color-rush":      "Color Rush",
  "word-scramble":   "Word Scramble",
}

const GAME_EMOJI: Record<string, string> = {
  "wordle":          "🟩",
  "higher-or-lower": "🔢",
  "tap-target":      "🎯",
  "2048":            "🧩",
  "color-rush":      "🎨",
  "word-scramble":   "📝",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GamePayoutsPage() {
  const [payouts, setPayouts]         = useState<Payout[]>([])
  const [totalKobo, setTotalKobo]     = useState(0)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    fetch("/api/games/my-payouts")
      .then(r => r.json())
      .then(j => {
        setPayouts(j.data ?? [])
        setTotalKobo(j.total_earned_kobo ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Group by week
  const byWeek = payouts.reduce<Record<string, Payout[]>>((acc, p) => {
    const key = p.week_start
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a))

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/dashboard/games" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Games & Earn
            </Link>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            My Winnings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your leaderboard prize history from weekly game tournaments.
          </p>
        </div>
        {!loading && totalKobo > 0 && (
          <div className="shrink-0 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-center">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">Total Earned</p>
            <p className="text-xl font-black text-amber-700 dark:text-amber-300">{fmt(totalKobo)}</p>
          </div>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-36" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 2 }).map((_, j) => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : payouts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Gamepad2 className="w-10 h-10 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-lg">No winnings yet</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Play games with entry fees to compete in weekly prize pools. Top 3 players share the prize.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/games">
                <Gamepad2 className="w-4 h-4 mr-2" />
                Play Games
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {weeks.map(week => {
            const weekPayouts = byWeek[week].sort((a, b) => a.rank - b.rank)
            const weekTotal   = weekPayouts.reduce((s, p) => s + p.payout_kobo, 0)

            return (
              <Card key={week} className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      Week of {weekLabel(week)}
                    </CardTitle>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      +{fmt(weekTotal)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {weekPayouts.map((payout) => (
                    <div
                      key={payout.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
                    >
                      {/* Rank icon */}
                      <div className="text-xl w-8 text-center shrink-0">
                        {RANK_ICON[payout.rank] ?? `#${payout.rank}`}
                      </div>

                      {/* Game info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm">
                            {GAME_EMOJI[payout.game_slug]} {GAME_NAMES[payout.game_slug] ?? payout.game_slug}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Rank #{payout.rank}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <Star className="w-3 h-3" />
                          Score: {payout.score.toLocaleString()}
                        </div>
                      </div>

                      {/* Payout */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                          <Coins className="w-3.5 h-3.5" />
                          {fmt(payout.payout_kobo)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(payout.created_at).toLocaleDateString("en-NG")}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}

          {/* Summary */}
          <Separator />
          <div className="flex items-center justify-between px-1 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              {payouts.length} prize{payouts.length !== 1 ? "s" : ""} won across {weeks.length} week{weeks.length !== 1 ? "s" : ""}
            </div>
            <div className="font-bold text-sm">
              Total: {fmt(totalKobo)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
