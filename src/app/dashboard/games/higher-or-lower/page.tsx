"use client"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowUp, ArrowDown, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

const MAX_GUESSES = 7

function scoreFromGuesses(guesses: number): number {
  const scores = [350, 200, 120, 70, 40, 20, 10]
  return scores[Math.min(guesses - 1, scores.length - 1)]
}

interface GuessRecord { value: number; hint: "higher" | "lower" | "correct" }

export default function HigherOrLowerPage() {
  const [secret, setSecret] = useState(0)
  const [date, setDate] = useState("")
  const [guess, setGuess] = useState("")
  const [history, setHistory] = useState<GuessRecord[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
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
      body: JSON.stringify({
        game_slug: "higher-or-lower",
        score,
        completed,
        metadata: { secret, guesses: guessCount, date },
      }),
    })
  }

  function handleGuess() {
    const num = parseInt(guess, 10)
    if (isNaN(num) || num < 1 || num > 100) {
      toast.error("Enter a number between 1 and 100")
      return
    }
    if (gameOver || alreadyPlayed) return

    let hint: GuessRecord["hint"]
    if (num === secret) hint = "correct"
    else if (num < secret) hint = "higher"
    else hint = "lower"

    const newHistory = [...history, { value: num, hint }]
    setHistory(newHistory)
    setGuess("")

    if (hint === "correct") {
      setWon(true)
      setGameOver(true)
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

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">🔢 Higher or Lower</h1>
          <p className="text-xs text-muted-foreground">Guess the number between 1–100 · {date}</p>
        </div>
        <div className="text-xs font-medium bg-muted rounded-lg px-3 py-1.5">
          {remaining} guess{remaining !== 1 ? "es" : ""} left
        </div>
      </div>

      {alreadyPlayed && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-center">
          You've already played today. Come back tomorrow!
        </div>
      )}

      {/* Big number display */}
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground mb-2">I'm thinking of a number…</p>
        <div className="text-6xl font-black text-primary">?</div>
        <p className="text-sm text-muted-foreground mt-2">Between 1 and 100</p>
      </div>

      {/* Guess input */}
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
            className="text-center text-lg font-bold"
          />
          <Button onClick={handleGuess} className="bounty-gradient text-white border-0">
            Guess
          </Button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your guesses</p>
          {history.map((g, i) => (
            <div key={i} className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
              g.hint === "correct" ? "border-emerald-500/30 bg-emerald-500/10"
              : g.hint === "higher" ? "border-blue-500/30 bg-blue-500/10"
              : "border-amber-500/30 bg-amber-500/10"
            }`}>
              <span className="font-bold text-lg">{g.value}</span>
              <div className="flex items-center gap-2 text-sm font-medium">
                {g.hint === "correct" && <><CheckCircle className="w-4 h-4 text-emerald-500" /> Correct!</>}
                {g.hint === "higher" && <><ArrowUp className="w-4 h-4 text-blue-500" /> Go higher</>}
                {g.hint === "lower" && <><ArrowDown className="w-4 h-4 text-amber-500" /> Go lower</>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {gameOver && (
        <div className={`rounded-xl p-5 text-center border ${won ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"}`}>
          {won
            ? <p className="font-bold text-emerald-700 dark:text-emerald-400">🎉 You found it in {history.length} guess{history.length !== 1 ? "es" : ""}! Score: {scoreFromGuesses(history.length)} pts</p>
            : <p className="font-bold text-destructive">😔 The number was <span className="text-2xl">{secret}</span>. Better luck tomorrow!</p>
          }
          <Link href="/dashboard/games" className="mt-3 inline-block text-sm text-primary underline">
            ← Back to games
          </Link>
        </div>
      )}
    </div>
  )
}
