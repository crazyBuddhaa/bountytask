"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Trophy, ArrowLeft, Crown, Medal } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { GAME_META, GAME_SLUGS } from "@/lib/games"
import type { GameSlug } from "@/lib/games"

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
  const sz = size === "lg" ? "w-14 h-14 text-lg" : size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs"
  return (
    <div className={`${sz} rounded-full bg-muted font-bold flex items-center justify-center overflow-hidden shrink-0 ring-2 ${row.is_me ? "ring-primary" : "ring-transparent"}`}>
      {row.avatar_url
        ? <img src={row.avatar_url} alt="" className="w-full h-full object-cover" />
        : row.display_name[0]?.toUpperCase()}
    </div>
  )
}

const PODIUM_RANK_ORDER = [2, 1, 3] // left, center, right
const PODIUM_HEIGHT = ["h-24", "h-36", "h-20"]
const PODIUM_BG = [
  "bg-slate-100 dark:bg-slate-800 border-slate-300/50 dark:border-slate-600/50",
  "bg-amber-50 dark:bg-amber-900/20 border-amber-300/60 dark:border-amber-600/40",
  "bg-orange-50/60 dark:bg-orange-900/10 border-orange-200/50 dark:border-orange-800/30",
]
const PODIUM_MEDAL = ["🥈", "🥇", "🥉"]

export default function LeaderboardPage() {
  const [game, setGame] = useState<GameSlug>("wordle")
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [weekStart, setWeekStart] = useState("")
  const [loading, setLoading] = useState(true)

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
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm">{weekLabel} · Resets every Monday</p>
        </div>
      </div>

      {/* Game picker */}
      <Select value={game} onValueChange={v => setGame(v as GameSlug)}>
        <SelectTrigger className="w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GAME_SLUGS.map(slug => (
            <SelectItem key={slug} value={slug}>
              {GAME_META[slug].emoji} {GAME_META[slug].name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="flex items-end justify-center gap-3 pb-2">
            {[56, 80, 44].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="w-full rounded-t-xl" style={{ height: h }} />
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <Skeleton className="w-7 h-5" />
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="py-20 text-center rounded-xl border bg-card">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
          <p className="font-semibold">No scores yet this week</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to claim the top spot!</p>
          <Link
            href={`/dashboard/games/${game}`}
            className="mt-4 inline-flex text-primary text-sm font-medium hover:underline underline-offset-2"
          >
            Play {GAME_META[game].name} →
          </Link>
        </div>
      )}

      {/* Podium (top 3) */}
      {!loading && top3.length > 0 && (
        <div className="flex items-end justify-center gap-3">
          {PODIUM_RANK_ORDER.map((rank, pi) => {
            const row = top3.find(r => r.rank === rank)
            if (!row) return <div key={rank} className="flex-1" />
            return (
              <div key={row.user_id} className="flex-1 flex flex-col items-center gap-1.5">
                {/* Crown for #1 */}
                {rank === 1 && <Crown className="w-5 h-5 text-amber-500 mb-0.5" />}

                <Avatar row={row} size={rank === 1 ? "lg" : "md"} />

                <p className={`text-xs font-semibold text-center truncate max-w-full px-1 leading-snug ${row.is_me ? "text-primary" : ""}`}>
                  {row.display_name}
                  {row.is_me && <span className="font-normal text-muted-foreground"> (you)</span>}
                </p>
                <p className="text-xs font-bold tabular-nums">{row.score.toLocaleString()}</p>

                {/* Podium block */}
                <div className={`w-full rounded-t-xl border-t border-x flex items-end justify-center pb-3 ${PODIUM_HEIGHT[pi]} ${PODIUM_BG[pi]}`}>
                  <span className="text-2xl">{PODIUM_MEDAL[pi]}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Rank 4+ list */}
      {!loading && rest.length > 0 && (
        <div className="rounded-xl border bg-card divide-y overflow-hidden">
          {rest.map(row => (
            <div
              key={row.user_id}
              className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${row.is_me ? "bg-primary/5" : "hover:bg-muted/40"}`}
            >
              <div className="w-7 text-center text-sm font-bold text-muted-foreground tabular-nums">
                {row.rank}
              </div>
              <Avatar row={row} size="sm" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${row.is_me ? "text-primary" : ""}`}>
                  {row.display_name}
                  {row.is_me && <span className="text-xs font-normal text-muted-foreground ml-1">(you)</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums">{row.score.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{GAME_META[game].leaderboardLabel}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My rank if outside top 20 */}
      {!loading && myRank && myRank > 20 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-center gap-4">
          <div className="w-7 text-center font-bold text-primary tabular-nums">#{myRank}</div>
          <div className="flex-1 text-sm font-medium text-primary">Your current rank</div>
          <p className="text-sm font-medium text-primary/80">Keep climbing! 🚀</p>
        </div>
      )}
    </div>
  )
}
