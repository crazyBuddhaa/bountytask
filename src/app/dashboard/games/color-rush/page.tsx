"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const GAME_DURATION = 30

interface ColorDef { name: string; hex: string }

const COLORS: ColorDef[] = [
  { name: "RED",    hex: "#ef4444" },
  { name: "BLUE",   hex: "#3b82f6" },
  { name: "GREEN",  hex: "#22c55e" },
  { name: "YELLOW", hex: "#eab308" },
  { name: "PURPLE", hex: "#a855f7" },
  { name: "ORANGE", hex: "#f97316" },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateRound() {
  const circleColor = pickRandom(COLORS)
  let labelColor: ColorDef
  do { labelColor = pickRandom(COLORS) } while (labelColor.name === circleColor.name)
  const pool = COLORS.filter(c => c.name !== circleColor.name)
  const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 3)
  const options = [...distractors, circleColor].sort(() => Math.random() - 0.5)
  return { circleColor, labelColor, options }
}

function Stars({ score }: { score: number }) {
  const n = score >= 20 ? 3 : score >= 12 ? 2 : 1
  return (
    <div className="flex justify-center gap-1">
      {[1, 2, 3].map(i => (
        <span key={i} className={`text-2xl ${i <= n ? "" : "opacity-20 grayscale"}`}>⭐</span>
      ))}
    </div>
  )
}

export default function ColorRushPage() {
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle")
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [streak, setStreak] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [round, setRound] = useState(() => generateRound())
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreRef  = useRef(0)
  const wrongRef  = useRef(0)
  const streakRef = useRef(0)

  const endGame = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setPhase("done")
  }, [])

  useEffect(() => {
    if (phase === "done" && !submitted) {
      setSubmitted(true)
      fetch("/api/games/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_slug: "color-rush",
          score: scoreRef.current,
          completed: true,
          duration_seconds: GAME_DURATION,
          metadata: { correct: scoreRef.current, wrong: wrongRef.current },
        }),
      })
    }
  }, [phase, submitted])

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  function startGame() {
    scoreRef.current = 0; wrongRef.current = 0; streakRef.current = 0
    setScore(0); setWrong(0); setStreak(0)
    setTimeLeft(GAME_DURATION); setFeedback(null); setSubmitted(false)
    setRound(generateRound()); setPhase("playing")
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { endGame(); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function handleAnswer(color: ColorDef) {
    if (feedback || phase !== "playing") return
    const isCorrect = color.name === round.circleColor.name
    setFeedback(isCorrect ? "correct" : "wrong")

    if (isCorrect) {
      scoreRef.current++
      streakRef.current++
      setScore(s => s + 1)
      setStreak(streakRef.current)
    } else {
      wrongRef.current++
      streakRef.current = 0
      setWrong(w => w + 1)
      setStreak(0)
    }
    setTimeout(() => { setFeedback(null); setRound(generateRound()) }, 380)
  }

  const progress  = ((GAME_DURATION - timeLeft) / GAME_DURATION) * 100
  const accuracy  = scoreRef.current + wrongRef.current > 0
    ? Math.round(scoreRef.current / (scoreRef.current + wrongRef.current) * 100)
    : 0

  return (
    <div className="flex flex-col gap-5 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex-1">🎨 Color Rush</h1>
        {phase === "playing" && (
          <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
            <Timer className="w-4 h-4 text-primary" />
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Idle */}
      {phase === "idle" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-violet-500/10 flex items-center justify-center text-4xl">🎨</div>
          <div>
            <h2 className="text-xl font-bold">Color Rush</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
              A circle appears. Tap the button that matches{" "}
              <strong>the circle's color</strong> — not the word!
            </p>
          </div>
          <div className="flex justify-center gap-6">
            {[{ hex: "#ef4444", label: "?" }, { hex: "#3b82f6", label: "?" }, { hex: "#22c55e", label: "?" }].map((c, i) => (
              <div key={i} className="w-10 h-10 rounded-full shadow-md" style={{ backgroundColor: c.hex }} />
            ))}
          </div>
          <Button onClick={startGame} className="bounty-gradient text-white border-0 px-10">
            Start!
          </Button>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>

          {/* Score row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">✓ {score}</span>
              <span className="text-destructive font-bold tabular-nums">✗ {wrong}</span>
            </div>
            {streak >= 3 ? (
              <span className="text-xs font-bold text-amber-500 tabular-nums animate-pulse">
                🔥 {streak} streak
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Tap the circle's color</span>
            )}
          </div>

          {/* Circle + Stroop label */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div
              className={`w-28 h-28 rounded-full shadow-xl transition-transform duration-150 ${
                feedback === "correct" ? "scale-110" : feedback === "wrong" ? "scale-90" : ""
              }`}
              style={{ backgroundColor: round.circleColor.hex }}
            />
            <p className="text-2xl font-black tracking-wide" style={{ color: round.labelColor.hex }}>
              {round.labelColor.name}
            </p>
          </div>

          {/* Option buttons */}
          <div className="grid grid-cols-2 gap-3">
            {round.options.map(opt => (
              <button
                key={opt.name}
                onClick={() => handleAnswer(opt)}
                disabled={!!feedback}
                className={`h-14 rounded-2xl font-bold text-white text-sm shadow-md transition-all active:scale-95
                  disabled:cursor-not-allowed
                  ${feedback && opt.name === round.circleColor.name
                    ? "ring-4 ring-offset-2 ring-emerald-500 scale-105"
                    : feedback && opt.name !== round.circleColor.name
                    ? "opacity-50"
                    : "hover:brightness-110"}`}
                style={{ backgroundColor: opt.hex }}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-4 animate-bounce-in">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-violet-500/10 flex items-center justify-center text-4xl">🎨</div>
          <div>
            <p className="text-5xl font-black tabular-nums">{score}</p>
            <p className="text-muted-foreground font-semibold mt-1">correct</p>
          </div>
          <Stars score={score} />
          <div className="flex justify-center gap-8 text-sm">
            <div className="text-center">
              <p className="text-xl font-bold tabular-nums">{wrong}</p>
              <p className="text-xs text-muted-foreground">wrong</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold tabular-nums">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">accuracy</p>
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {score >= 20 ? "🔥 Incredible focus!" : score >= 12 ? "👏 Great reflexes!" : "Keep playing to improve!"}
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={startGame} className="bounty-gradient text-white border-0">Play Again</Button>
            <Link href="/dashboard/games"><Button variant="outline">All Games</Button></Link>
          </div>
        </div>
      )}
    </div>
  )
}
