"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ArrowUp, ArrowDown, CheckCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

const MAX_GUESSES = 7

function scoreFromGuesses(guesses: number): number {
  const scores = [350, 200, 120, 70, 40, 20, 10]
  return scores[Math.min(guesses - 1, scores.length - 1)]
}

interface GuessRecord { value: number; hint: "higher" | "lower" | "correct" }

function Stars({ won, guesses }: { won: boolean; guesses: number }) {
  const n = !won ? 0 : guesses <= 3 ? 3 : guesses <= 5 ? 2 : 1
  return (
    <div className="flex justify-center gap-1.5">
      {[1, 2, 3].map(i => (
        <span key={i} className={`text-2xl ${i <= n ? "" : "opacity-20 grayscale"}`}>⭐</span>
      ))}
    </div>
  )
}

export default function HigherOrLowerPage() {
  const [secret, setSecret]   = useState(0)
  const [date, setDate]       = useState("")
  const [guess, setGuess]     = useState("")
  const [history, setHistory] = useState<GuessRecord[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon]         = useState(false)
  const [loading, setLoading] = useState(true)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const [minVal, setMinVal]   = useState(1)
  const [maxVal, setMaxVal]   = useState(100)
  const sessionSaved = useRef(false)

  useEffect(() => {
    fetch("/api/games/seed?game=higher-or-lower")
      .then(r => r.json())
      .then(j => { setSecret(j.number ?? 50); setDate(j.date ?? ""); setLoading(false) })
    fetch("/api/games/my-stats")
      .then(r => r.json())
      .then(j => { if (j.data?.["higher-or-lower"]?.completed_today) setAlreadyPlayed(true) })
  }, [])

  async function saveSession(completed: boolean, score: number, guessCount: number) {
    if (sessionSaved.current) return
    sessionSaved.current = true
    await fetch("/api/games/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_slug: "higher-or-lower", score, completed, metadata: { secret, guesses: guessCount, date } }),
    })
  }

  function handleGuess() {
    const num = parseInt(guess, 10)
    if (isNaN(num) || num < 1 || num > 100) {
      toast.error("Enter a number between 1 and 100")
      return
    }
    if (gameOver || alreadyPlayed) return

    const hint: GuessRecord["hint"] = num === secret ? "correct" : num < secret ? "higher" : "lower"
    const newHistory = [...history, { value: num, hint }]
    setHistory(newHistory)
    setGuess("")

    if (hint === "higher") setMinVal(Math.max(minVal, num + 1))
    if (hint === "lower")  setMaxVal(Math.min(maxVal, num - 1))

    if (hint === "correct") {
      setWon(true); setGameOver(true)
      const score = scoreFromGuesses(newHistory.length)
      toast.success(`🎉 Correct! +${score} pts in ${newHistory.length} ${newHistory.length === 1 ? "guess" : "guesses"}`)
      saveSession(true, score, newHistory.length)
    } else if (newHistory.length >= MAX_GUESSES) {
      setGameOver(true)
      toast.error(`Out of guesses! The number was ${secret}`)
      saveSession(false, 0, MAX_GUESSES)
    }
  }

  const remaining = MAX_GUESSES - history.length
  const rangeSpan = maxVal - minVal
  const barWidth  = Math.max(4, (rangeSpan / 99) * 100)
  const barLeft   = ((minVal - 1) / 99) * 100

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-black text-xl text-blue-600 dark:text-blue-400">Higher or Lower</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {date} · Guess 1–100
          </p>
        </div>
        <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border tabular-nums ${
          remaining <= 2
            ? "bg-destructive/10 text-destructive border-destructive/30"
            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
        }`}>
          {remaining} guess{remaining !== 1 ? "es" : ""} left
        </div>
      </div>

      {alreadyPlayed && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/8 px-4 py-3 text-sm text-center text-blue-700 dark:text-blue-400 font-medium">
          ✅ You've already played today — come back tomorrow!
        </div>
      )}

      {/* Mystery number display */}
      <div className="relative rounded-2xl overflow-hidden border border-blue-500/30 bg-card">
        <div className="absolute inset-0 opacity-10">
          <Image src="/games/higher-or-lower.jpg" alt="" fill className="object-cover" sizes="100vw" />
        </div>
        <div className="relative px-6 py-8 text-center">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">I'm thinking of…</p>
          <div className={`text-8xl font-black tabular-nums transition-all duration-500 ${
            gameOver && won ? "text-emerald-500 drop-shadow-lg" : "text-blue-500 dark:text-blue-400"
          }`}>
            {gameOver && won ? secret : "?"}
          </div>
          <p className="text-xs text-muted-foreground mt-3">A number between 1 and 100</p>
          {!gameOver && history.length > 0 && (
            <p className="text-sm font-bold text-blue-400 mt-1">
              Narrowed to {minVal}–{maxVal}
            </p>
          )}
        </div>
      </div>

      {/* Range bar */}
      {history.length > 0 && !gameOver && (
        <div className="space-y-2 px-1">
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>Possible range</span>
            <span className="tabular-nums font-bold text-blue-500">{minVal} – {maxVal}</span>
          </div>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute top-0 h-full bg-blue-500/60 rounded-full transition-all duration-500"
              style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>1</span><span>50</span><span>100</span>
          </div>
        </div>
      )}

      {/* Input */}
      {!gameOver && !alreadyPlayed && (
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            max={100}
            placeholder="Your guess…"
            value={guess}
            onChange={e => setGuess(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleGuess()}
            className="text-center text-xl font-black border-blue-500/30 focus:border-blue-500"
          />
          <Button onClick={handleGuess} className="bg-blue-500 hover:bg-blue-600 text-white border-0 px-6 font-bold shadow-md shadow-blue-500/30">
            Guess
          </Button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your guesses</p>
          <div className="space-y-1.5">
            {history.map((g, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-all ${
                  g.hint === "correct"
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : g.hint === "higher"
                    ? "border-blue-500/30 bg-blue-500/8"
                    : "border-amber-500/30 bg-amber-500/8"
                }`}
              >
                <span className="text-lg font-black tabular-nums">{g.value}</span>
                <div className={`flex items-center gap-1.5 text-sm font-bold ${
                  g.hint === "correct" ? "text-emerald-500"
                  : g.hint === "higher" ? "text-blue-500"
                  : "text-amber-500"
                }`}>
                  {g.hint === "correct" && <><CheckCircle className="w-4 h-4" /> Correct!</>}
                  {g.hint === "higher"  && <><ArrowUp className="w-4 h-4" /> Go higher</>}
                  {g.hint === "lower"   && <><ArrowDown className="w-4 h-4" /> Go lower</>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {gameOver && (
        <div className={`rounded-2xl border p-6 text-center space-y-4 animate-bounce-in ${
          won ? "border-emerald-500/40 bg-emerald-500/8" : "border-destructive/30 bg-destructive/8"
        }`}>
          <Stars won={won} guesses={history.length} />
          {won ? (
            <>
              <p className="font-black text-emerald-500 text-xl">
                🎉 Found it in {history.length} {history.length === 1 ? "guess" : "guesses"}!
              </p>
              <p className="text-sm text-muted-foreground font-semibold">+{scoreFromGuesses(history.length)} points earned</p>
            </>
          ) : (
            <>
              <p className="font-black text-destructive text-xl">😔 Out of guesses!</p>
              <p className="text-sm text-muted-foreground">
                The number was <span className="text-3xl font-black text-foreground">{secret}</span>
              </p>
            </>
          )}
          <Link href="/dashboard/games">
            <Button variant="outline" size="sm">← Back to Games</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
