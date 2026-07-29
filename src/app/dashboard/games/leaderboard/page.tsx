"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Trophy, ArrowLeft, Crown, Gift, Sparkles } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { GAME_META, GAME_SLUGS } from "@/lib/games"
import type { GameSlug } from "@/lib/games"
import type { Payout } from "@/app/api/games/my-payouts/route"

interface LeaderboardEntry {
  rank: number
  user_id: string
  is_me: boolean
  display_name: string
  avatar_url: string | null
  score: number
  last_played_at: string
}

function Avatar({
  row, size = "md",
}: {
  row: Pick<LeaderboardEntry, "avatar_url" | "display_name" | "is_me">
  size?: "sm" | "md" | "lg"
}) {
  const sz = size === "lg" ? "w-16 h-16 text-xl" : size === "md" ? "w-11 h-11 text-sm" : "w-8 h-8 text-xs"
  return (
    <div className={`${sz} rounded-full font-black flex items-center justify-center overflow-hidden shrink-0 ring-2 transition-all ${
      row.is_me ? "ring-primary shadow-lg shadow-primary/30" : "ring-transparent bg-muted"
    }`}>
      {row.avatar_url
        ? <img src={row.avatar_url} alt="" className="w-full h-full object-cover" />
        : <span className={`${row.is_me ? "bg-primary text-primary-foreground w-full h-full flex items-center justify-center" : ""}`}>
            {row.display_name[0]?.toUpperCase()}
          </span>
      }
    </div>
  )
}

const PODIUM_ORDER  = [2, 1, 3] // display order: silver, gold, bronze
const PODIUM_HEIGHT = ["h-20", "h-32", "h-16"]
const PODIUM_CONFIG = [
  { medal: "🥈", glow: "shadow-slate-400/30",  border: "border-slate-400/50 dark:border-slate-500/50", bg: "bg-slate-100 dark:bg-slate-800/60",  ring: "ring-slate-400" },
  { medal: "🥇", glow: "shadow-amber-400/40",  border: "border-amber-400/60 dark:border-amber-500/50", bg: "bg-amber-50 dark:bg-amber-900/30",   ring: "ring-amber-400" },
  { medal: "🥉", glow: "shadow-orange-400/25", border: "border-orange-300/50 dark:border-orange-700/40", bg: "bg-orange-50/80 dark:bg-orange-900/15", ring: "ring-orange-400" },
]

const GAME_COLORS: Record<GameSlug, string> = {
  'wordle':          'text-emerald-500',
  'higher-or-lower': 'text-blue-500',
  'tap-target':      'text-red-500',
  '2048':            'text-amber-500',
  'color-rush':      'text-violet-500',
  'word-scramble':   'text-pink-500',
}

function fmt(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
}

export default function LeaderboardPage() {
  const [game, setGame]         = useState<GameSlug>("wordle")
  const [rows, setRows]         = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank]     = useState<number | null>(null)
  const [weekStart, setWeekStart] = useState("")
  const [loading, setLoading]   = useState(true)

  const [payouts, setPayouts]         = useState<Payout[]>([])
  const [totalEarned, setTotalEarned] = useState(0)
  const [payoutsLoading, setPayoutsLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/games/leaderboard?game=${game}&limit=20`)
      .then(r => r.json())
      .then(j => {
        setRows(j.data ?? [])
        setMyRank(j.my_rank ?? null)
        setWeekStart(j.week_start ?? "")
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [game])

  useEffect(() => {
    fetch("/api/games/my-payouts")
      .then(r => r.json())
      .then(j => {
        setPayouts(j.data ?? [])
        setTotalEarned(j.total_earned_kobo ?? 0)
        setPayoutsLoading(false)
      })
      .catch(() => setPayoutsLoading(false))
  }, [])

  const weekLabel = weekStart
    ? `Week of ${new Date(weekStart).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}`
    : "This week"

  const top3 = rows.filter(r => r.rank <= 3)
  const rest  = rows.filter(r => r.rank > 3)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span className="bounty-text-gradient">Leaderboard</span>
          </h1>
          <p className="text-muted-foreground text-sm">{weekLabel} · Resets every Monday</p>
        </div>
      </div>

      <Tabs defaultValue="rankings">
        <TabsList className="w-full h-11">
          <TabsTrigger value="rankings" className="flex-1 gap-1.5 font-semibold">
            <Trophy className="w-3.5 h-3.5" />
            Weekly Rankings
          </TabsTrigger>
          <TabsTrigger value="winnings" className="flex-1 gap-1.5 font-semibold">
            <Gift className="w-3.5 h-3.5" />
            My Winnings
            {totalEarned > 0 && (
              <span className="ml-1 text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full px-1.5 py-0.5 tabular-nums">
                {fmt(totalEarned)}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Rankings tab ──────────────────────────────────────────── */}
        <TabsContent value="rankings" className="space-y-5 mt-5">
          {/* Game picker — horizontal scroll tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {GAME_SLUGS.map(slug => (
              <button
                key={slug}
                onClick={() => setGame(slug)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 ${
                  game === slug
                    ? `bounty-gradient text-white border-transparent shadow-md shadow-primary/30`
                    : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                <span>{GAME_META[slug].emoji}</span>
                {GAME_META[slug].name}
              </button>
            ))}
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-4">
              <div className="flex items-end justify-center gap-4">
                {[56, 80, 44].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="w-full rounded-t-2xl" style={{ height: h }} />
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border bg-card divide-y overflow-hidden">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <Skeleton className="w-7 h-5" />
                    <Skeleton className="w-9 h-9 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && rows.length === 0 && (
            <div className="py-20 text-center rounded-2xl border bg-card">
              <Trophy className="w-14 h-14 mx-auto mb-4 text-muted-foreground/20" />
              <p className="font-black text-lg">No scores yet this week</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to claim the top spot!</p>
              <Link
                href={`/dashboard/games/${game}`}
                className="mt-4 inline-flex items-center gap-1 text-primary text-sm font-bold hover:underline underline-offset-2"
              >
                Play {GAME_META[game].name} →
              </Link>
            </div>
          )}

          {/* Podium */}
          {!loading && top3.length > 0 && (
            <div className="flex items-end justify-center gap-3 pt-4 pb-2">
              {PODIUM_ORDER.map((rank, pi) => {
                const row = top3.find(r => r.rank === rank)
                const cfg = PODIUM_CONFIG[pi]
                if (!row) return <div key={rank} className="flex-1" />
                return (
                  <div key={row.user_id} className="flex-1 flex flex-col items-center gap-2">
                    {rank === 1 && (
                      <Crown className="w-6 h-6 text-amber-500 drop-shadow-md mb-0.5" />
                    )}
                    <div className={`ring-2 ${cfg.ring} rounded-full shadow-lg ${cfg.glow}`}>
                      <Avatar row={row} size={rank === 1 ? "lg" : "md"} />
                    </div>
                    <p className={`text-xs font-bold text-center truncate max-w-full px-1 leading-tight ${row.is_me ? "text-primary" : ""}`}>
                      {row.display_name}
                      {row.is_me && <span className="font-normal text-muted-foreground"> (you)</span>}
                    </p>
                    <p className={`text-xs font-black tabular-nums ${GAME_COLORS[game]}`}>
                      {row.score.toLocaleString()}
                    </p>
                    <div className={`w-full rounded-t-2xl border-t border-x flex items-end justify-center pb-3 shadow-inner ${PODIUM_HEIGHT[pi]} ${cfg.bg} ${cfg.border}`}>
                      <span className="text-2xl drop-shadow">{cfg.medal}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Rank 4+ list */}
          {!loading && rest.length > 0 && (
            <div className="rounded-2xl border bg-card overflow-hidden divide-y">
              {rest.map(row => (
                <div
                  key={row.user_id}
                  className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                    row.is_me ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40"
                  }`}
                >
                  <div className={`w-7 text-center text-sm font-black tabular-nums ${
                    row.rank <= 10 ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {row.rank}
                  </div>
                  <Avatar row={row} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${row.is_me ? "text-primary" : ""}`}>
                      {row.display_name}
                      {row.is_me && <span className="text-xs font-normal text-muted-foreground ml-1">(you)</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black tabular-nums ${GAME_COLORS[game]}`}>{row.score.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{GAME_META[game].leaderboardLabel}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* My rank if outside top 20 */}
          {!loading && myRank && myRank > 20 && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-center gap-4">
              <div className="w-7 text-center font-black text-primary tabular-nums text-sm">#{myRank}</div>
              <div className="flex-1 text-sm font-semibold text-primary">Your current rank</div>
              <p className="text-sm font-bold text-primary/80 flex items-center gap-1">
                Keep climbing! 🚀
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── My Winnings tab ─────────────────────────────────────── */}
        <TabsContent value="winnings" className="space-y-5 mt-5">
          {payoutsLoading && (
            <div className="rounded-2xl border bg-card divide-y overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          )}

          {!payoutsLoading && payouts.length === 0 && (
            <div className="py-20 text-center rounded-2xl border bg-card">
              <div className="w-16 h-16 rounded-2xl bounty-gradient mx-auto mb-4 flex items-center justify-center shadow-lg shadow-primary/30">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <p className="font-black text-lg">No winnings yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Finish in the top 3 on any weekly leaderboard to earn prize money.
              </p>
              <Link
                href="/dashboard/games"
                className="mt-4 inline-flex items-center gap-1 text-primary text-sm font-bold hover:underline underline-offset-2"
              >
                Play games →
              </Link>
            </div>
          )}

          {!payoutsLoading && payouts.length > 0 && (
            <>
              {/* Total earned banner */}
              <div className="bounty-gradient p-px rounded-2xl">
                <div className="rounded-[calc(1rem-1px)] bg-card/95 backdrop-blur-sm px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bounty-gradient flex items-center justify-center shadow-lg shadow-primary/30">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-base">Total prize earnings</p>
                      <p className="text-xs text-muted-foreground">{payouts.length} prize{payouts.length !== 1 ? "s" : ""} across all games</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-amber-500 tabular-nums">{fmt(totalEarned)}</p>
                  </div>
                </div>
              </div>

              {/* Payout history */}
              <div className="rounded-2xl border bg-card overflow-hidden divide-y">
                {payouts.map((p: Payout) => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="w-11 h-11 rounded-2xl bounty-gradient flex items-center justify-center text-xl shrink-0 shadow-md shadow-primary/20">
                      {GAME_META[p.game_slug as GameSlug]?.emoji ?? "🎮"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">
                        {["🥇","🥈","🥉"][p.rank - 1] ?? `#${p.rank}`}{" "}
                        {GAME_META[p.game_slug as GameSlug]?.name ?? p.game_slug}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.week_start + "T00:00:00Z").toLocaleDateString("en-NG", {
                          month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-amber-500 tabular-nums">{fmt(p.payout_kobo)}</p>
                      <p className="text-xs font-semibold text-emerald-500">✓ Credited</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
