"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
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
    <div className="flex justify-center gap-1.5">
      {[1, 2, 3].map(i => (
        <span key={i} className={`text-2xl ${i <= n ? "" : "opacity-20 grayscale"}`}>⭐</span>
      ))}
    </div>
  )
}

export default function ColorRushPage() {
  const [phase, setPhase]     = useState<"idle" | "playing" | "done">("idle")
  const [score, setScore]     = useState(0)
  const [wrong, setWrong]     = useState(0)
  const [streak, setStreak]   = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [round, setRound]     = useState(() => generateRound())
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
  const urgency   = timeLeft <= 8

  return (
    <div className="flex flex-col gap-5 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-black text-violet-500 flex-1">Color Rush</h1>
        {phase === "playing" && (
          <div className={`flex items-center gap-1.5 text-sm font-black tabular-nums px-3 py-1.5 rounded-xl border ${
            urgency
              ? "text-red-400 bg-red-500/10 border-red-500/40 animate-pulse"
              : "text-violet-400 bg-violet-500/10 border-violet-500/30"
          }`}>
            <Timer className="w-4 h-4" />
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Idle */}
      {phase === "idle" && (
        <div className="rounded-2xl overflow-hidden border border-violet-500/30 bg-card">
          <div className="relative h-48">
            <Image src="/games/color-rush.jpg" alt="Color Rush" fill className="object-cover" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-5 right-5">
              <h2 className="text-2xl font-black text-white">Color Rush</h2>
              <p className="text-white/70 text-sm mt-0.5">Don't be fooled by the words!</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <p className="text-muted-foreground text-sm text-center">
              A circle appears. Tap the button matching{" "}
              <strong className="text-foreground">the circle's color</strong> — not the word!
            </p>
            <div className="flex justify-center gap-3">
              {COLORS.slice(0, 4).map(c => (
                <div key={c.name} className="w-10 h-10 rounded-full shadow-lg border-2 border-white/20" style={{ backgroundColor: c.hex }} />
              ))}
            </div>
            <Button onClick={startGame} className="w-full bg-violet-500 hover:bg-violet-600 text-white border-0 font-black text-base py-6 shadow-lg shadow-violet-500/30">
              Start!
            </Button>
          </div>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${urgency ? "bg-red-500" : "bg-violet-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Score row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-emerald-500 font-black tabular-nums">✓ {score}</span>
              <span className="text-destructive font-black tabular-nums">✗ {wrong}</span>
            </div>
            {streak >= 3 ? (
              <span className="text-xs font-black text-amber-500 tabular-nums animate-pulse">
                🔥 {streak} streak
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Tap the circle's color</span>
            )}
          </div>

          {/* Circle + Stroop label */}
          <div className="flex flex-col items-center gap-4 py-3">
            <div
              className={`w-32 h-32 rounded-full shadow-2xl transition-all duration-150 ${
                feedback === "correct" ? "scale-110" : feedback === "wrong" ? "scale-90" : ""
              }`}
              style={{
                backgroundColor: round.circleColor.hex,
                boxShadow: `0 0 40px ${round.circleColor.hex}55`,
              }}
            />
            <p className="text-3xl font-black tracking-widest" style={{ color: round.labelColor.hex, textShadow: `0 0 20px ${round.labelColor.hex}55` }}>
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
                className={`h-14 rounded-2xl font-black text-white text-sm shadow-lg transition-all active:scale-95
                  disabled:cursor-not-allowed
                  ${feedback && opt.name === round.circleColor.name
                    ? "ring-4 ring-offset-2 ring-white scale-105"
                    : feedback && opt.name !== round.circleColor.name
                    ? "opacity-40"
                    : "hover:brightness-110 hover:scale-[1.02]"}`}
                style={{
                  backgroundColor: opt.hex,
                  boxShadow: `0 4px 15px ${opt.hex}44`,
                }}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="rounded-2xl border border-violet-500/30 bg-card overflow-hidden animate-bounce-in">
          <div className="relative h-32 overflow-hidden">
            <Image src="/games/color-rush.jpg" alt="" fill className="object-cover opacity-50" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
          </div>
          <div className="px-6 pb-6 -mt-8 relative text-center space-y-4">
            <p className="text-6xl font-black tabular-nums text-violet-500 drop-shadow-lg">{score}</p>
            <p className="text-muted-foreground font-bold -mt-2">correct</p>
            <Stars score={score} />
            <div className="flex justify-center gap-8 text-sm">
              <div className="text-center">
                <p className="text-2xl font-black tabular-nums">{wrong}</p>
                <p className="text-xs text-muted-foreground">wrong</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black tabular-nums">{accuracy}%</p>
                <p className="text-xs text-muted-foreground">accuracy</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              {score >= 20 ? "🔥 Incredible focus!" : score >= 12 ? "👏 Great reflexes!" : "Keep playing to improve!"}
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={startGame} className="bg-violet-500 hover:bg-violet-600 text-white border-0 font-bold shadow-md shadow-violet-500/30">Play Again</Button>
              <Link href="/dashboard/games"><Button variant="outline">All Games</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
