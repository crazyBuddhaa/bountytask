"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Trophy, Medal, ArrowLeft, Crown } from "lucide-react"
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

const RANK_COLORS = ["text-amber-500", "text-slate-400", "text-amber-700"]
const RANK_ICONS = [Crown, Medal, Medal]

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

  return (
    <div className="space-y-6 max-w-2xl">
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
        <SelectTrigger className="w-56">
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

      {/* Board */}
      <div className="rounded-xl border bg-card divide-y">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="w-7 h-5" />
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No scores yet this week. Be the first!</p>
            <Link href={`/dashboard/games/${game}`} className="mt-3 inline-block text-primary underline text-sm">
              Play now →
            </Link>
          </div>
        ) : (
          rows.map(row => {
            const Icon = RANK_ICONS[row.rank - 1]
            const rankColor = RANK_COLORS[row.rank - 1] ?? "text-muted-foreground"
            return (
              <div
                key={row.user_id}
                className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${row.is_me ? "bg-primary/5" : "hover:bg-muted/30"}`}
              >
                {/* Rank */}
                <div className={`w-7 text-center font-bold text-sm ${rankColor}`}>
                  {row.rank <= 3 && Icon ? <Icon className="w-5 h-5 mx-auto" /> : row.rank}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0">
                  {row.avatar_url
                    ? <img src={row.avatar_url} alt="" className="w-full h-full object-cover" />
                    : row.display_name[0].toUpperCase()
                  }
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${row.is_me ? "text-primary" : ""}`}>
                    {row.display_name} {row.is_me && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{row.score.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{GAME_META[game].leaderboardLabel}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* My rank if outside top 20 */}
      {!loading && myRank && myRank > 20 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-3.5 flex items-center gap-4">
          <div className="w-7 text-center font-bold text-sm text-primary">{myRank}</div>
          <div className="flex-1 text-sm font-medium text-primary">Your current rank</div>
          <p className="text-sm font-bold text-primary">Keep playing to climb!</p>
        </div>
      )}
    </div>
  )
}
