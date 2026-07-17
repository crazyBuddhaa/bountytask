"use client"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Trophy, Gamepad2, CheckCircle2, Clock, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Payout {
  id: string
  rank: number
  score: number
  payout_kobo: number
  user: { full_name: string | null; username: string | null } | null
}

interface Pool {
  id: string
  game_slug: string
  week_start: string
  total_entries: number
  total_collected_kobo: number
  prize_pool_kobo: number
  platform_cut_kobo: number
  settled: boolean
  settled_at: string | null
  leaderboard_payouts: Payout[]
}

const GAME_EMOJI: Record<string, string> = {
  "wordle":          "🟩",
  "higher-or-lower": "🔢",
  "tap-target":      "🎯",
  "2048":            "🧩",
  "color-rush":      "🎨",
  "word-scramble":   "📝",
}

const RANK_ICON = ["🥇", "🥈", "🥉"]

function fmt(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
}

function weekLabel(start: string) {
  const d = new Date(`${start}T00:00:00Z`)
  const end = new Date(d)
  end.setUTCDate(d.getUTCDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" }
  return `${d.toLocaleDateString("en-NG", opts)} – ${end.toLocaleDateString("en-NG", { ...opts, year: "numeric" })}`
}

export default function AdminGamesPage() {
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState<string | null>(null)

  async function fetchPools() {
    const r = await fetch("/api/admin/games/pools")
    const j = await r.json()
    setPools(j.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchPools() }, [])

  async function settle(pool: Pool) {
    setSettling(pool.id)
    const r = await fetch("/api/admin/games/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool_id: pool.id }),
    })
    const j = await r.json()
    setSettling(null)
    if (j.error) {
      toast.error(j.error)
    } else {
      const { payouts } = j.data as { payouts: { rank: number; display_name: string; payout_kobo: number }[] }
      toast.success(
        `Settled! ${payouts.map(p => `#${p.rank} ${p.display_name} → ${fmt(p.payout_kobo)}`).join(" · ")}`,
        { duration: 8000 }
      )
      fetchPools()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  const unsettled = pools.filter(p => !p.settled)
  const settled   = pools.filter(p =>  p.settled)

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gamepad2 className="w-6 h-6 text-primary" /> Games — Prize Pools
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Settle weekly leaderboards to credit prize money to top-3 players. Entry fees are split 80 % prize / 20 % platform.
        </p>
      </div>

      {pools.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No prize pools yet. Enable entry fees in <strong>Settings → Games & Entry Fees</strong>.
          </CardContent>
        </Card>
      )}

      {unsettled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending settlement
          </h2>
          {unsettled.map(pool => (
            <PoolCard key={pool.id} pool={pool} onSettle={settle} settling={settling === pool.id} />
          ))}
        </section>
      )}

      {settled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Settled
          </h2>
          {settled.map(pool => (
            <PoolCard key={pool.id} pool={pool} onSettle={settle} settling={false} />
          ))}
        </section>
      )}
    </div>
  )
}

function PoolCard({ pool, onSettle, settling }: { pool: Pool; onSettle: (p: Pool) => void; settling: boolean }) {
  const payouts = [...pool.leaderboard_payouts].sort((a, b) => a.rank - b.rank)

  return (
    <Card className={pool.settled ? "opacity-70" : "border-amber-400/60"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span>{GAME_EMOJI[pool.game_slug] ?? "🎮"}</span>
              <span className="capitalize">{pool.game_slug.replace(/-/g, " ")}</span>
              {pool.settled
                ? <Badge variant="secondary" className="text-xs">Settled</Badge>
                : <Badge className="text-xs bg-amber-500 text-white border-0">Pending</Badge>
              }
            </CardTitle>
            <CardDescription className="mt-0.5">{weekLabel(pool.week_start)}</CardDescription>
          </div>
          {!pool.settled && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={settling} className="shrink-0">
                  {settling ? <Loader2 className="animate-spin w-4 h-4" /> : <Trophy className="w-4 h-4" />}
                  Settle
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Settle {pool.game_slug} — {weekLabel(pool.week_start)}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will credit {fmt(pool.prize_pool_kobo)} to the top-3 players (50 % / 30 % / 20 %) and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onSettle(pool)}>Confirm & Settle</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Entries" value={pool.total_entries.toString()} />
          <Stat label="Prize pool" value={fmt(pool.prize_pool_kobo)} highlight />
          <Stat label="Platform cut" value={fmt(pool.platform_cut_kobo)} />
        </div>

        {/* Payouts (settled) */}
        {payouts.length > 0 && (
          <div className="border-t pt-3 space-y-1.5">
            {payouts.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span>{RANK_ICON[p.rank - 1] ?? `#${p.rank}`}</span>
                <span className="flex-1 text-muted-foreground">
                  {p.user?.full_name ?? p.user?.username ?? "Unknown player"}
                </span>
                <span className="font-medium flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-500" /> {fmt(p.payout_kobo)}
                </span>
                <span className="text-xs text-muted-foreground">score {p.score}</span>
              </div>
            ))}
          </div>
        )}

        {!pool.settled && payouts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            No payouts recorded yet — settle to calculate winners.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${highlight ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted"}`}>
      <p className={`text-base font-semibold ${highlight ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
