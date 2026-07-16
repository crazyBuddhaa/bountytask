"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const GAME_DURATION = 30 // seconds
const BASE_TIME_PER_Q = 3000 // ms (shrinks as game progresses)
const MIN_TIME_PER_Q = 1200

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

function generateRound(prevColors: ColorDef[] = []) {
  // Circle color = the "correct" answer
  const circleColor = pickRandom(COLORS)
  // Label color is different from circleColor (Stroop misdirection)
  let labelColor: ColorDef
  do { labelColor = pickRandom(COLORS) } while (labelColor.name === circleColor.name)

  // 4 option buttons: correct + 3 random distractors
  const pool = COLORS.filter(c => c.name !== circleColor.name)
  const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 3)
  const options = [...distractors, circleColor].sort(() => Math.random() - 0.5)

  return { circleColor, labelColor, options }
}

export default function ColorRushPage() {
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle")
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [round, setRound] = useState(() => generateRound())
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoreRef = useRef(0)
  const wrongRef = useRef(0)

  const endGame = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (questionTimerRef.current) clearTimeout(questionTimerRef.current)
    setPhase("done")
  }, [])

  useEffect(() => {
    if (phase === "done" && !submitted) {
      setSubmitted(true)
      const s = scoreRef.current
      fetch("/api/games/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_slug: "color-rush",
          score: s,
          completed: true,
          duration_seconds: GAME_DURATION,
          metadata: { correct: s, wrong: wrongRef.current },
        }),
      })
    }
  }, [phase, submitted])

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (questionTimerRef.current) clearTimeout(questionTimerRef.current)
  }, [])

  function startGame() {
    setScore(0)
    setWrong(0)
    setTimeLeft(GAME_DURATION)
    setFeedback(null)
    setSubmitted(false)
    setRound(generateRound())
    setPhase("playing")
    scoreRef.current = 0
    wrongRef.current = 0

    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { endGame(); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function nextRound(currentScore: number) {
    const elapsed = (GAME_DURATION - timeLeft) / GAME_DURATION
    const timeForQ = Math.max(MIN_TIME_PER_Q, BASE_TIME_PER_Q - elapsed * 1800)
    setFeedback(null)
    setRound(generateRound())
  }

  function handleAnswer(color: ColorDef) {
    if (feedback || phase !== "playing") return
    const isCorrect = color.name === round.circleColor.name
    setFeedback(isCorrect ? "correct" : "wrong")

    if (isCorrect) {
      scoreRef.current++
      setScore(s => s + 1)
    } else {
      wrongRef.current++
      setWrong(w => w + 1)
    }

    setTimeout(() => nextRound(scoreRef.current), 400)
  }

  const progress = ((GAME_DURATION - timeLeft) / GAME_DURATION) * 100

  return (
    <div className="flex flex-col gap-5 max-w-sm mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex-1">🎨 Color Rush</h1>
        {phase === "playing" && (
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <Timer className="w-4 h-4 text-primary" />
            {timeLeft}s
          </div>
        )}
      </div>

      {phase === "idle" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-5xl">🎨</p>
          <h2 className="text-xl font-bold">Color Rush</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            A circle appears. Tap the button matching the <strong>circle's color</strong> — not the word's color!<br />
            <span className="text-xs">30 seconds. How many can you get right?</span>
          </p>
          <Button onClick={startGame} className="bounty-gradient text-white border-0 px-8">
            Start!
          </Button>
        </div>
      )}

      {phase === "playing" && (
        <div className="space-y-5">
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary rounded-full h-2 transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>

          {/* Score display */}
          <div className="flex justify-between text-sm">
            <span className="text-emerald-600 font-bold">✓ {score}</span>
            <span className="text-destructive font-bold">✗ {wrong}</span>
          </div>

          {/* Instruction */}
          <p className="text-center text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Tap the color of the circle →
          </p>

          {/* The circle with misdirection label */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={`w-28 h-28 rounded-full shadow-lg transition-transform ${
                feedback === "correct" ? "scale-110" : feedback === "wrong" ? "scale-90" : ""
              }`}
              style={{ backgroundColor: round.circleColor.hex }}
            />
            {/* Stroop label — color name written in a different color */}
            <p className="text-2xl font-black" style={{ color: round.labelColor.hex }}>
              {round.labelColor.name}
            </p>
          </div>

          {/* Option buttons */}
          <div className="grid grid-cols-2 gap-3">
            {round.options.map(opt => (
              <button
                key={opt.name}
                onClick={() => handleAnswer(opt)}
                className={`h-14 rounded-xl font-bold text-white text-sm shadow transition-all active:scale-95 ${
                  feedback && opt.name === round.circleColor.name
                    ? "ring-2 ring-offset-2 ring-emerald-500 scale-105"
                    : ""
                }`}
                style={{ backgroundColor: opt.hex }}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-5xl">🎨</p>
          <h2 className="text-2xl font-black">{score} correct!</h2>
          <p className="text-muted-foreground text-sm">{wrong} wrong · Accuracy: {score + wrong > 0 ? Math.round(score / (score + wrong) * 100) : 0}%</p>
          <p className="text-sm">{score >= 20 ? "🔥 Incredible!" : score >= 12 ? "👏 Great reflexes!" : "Keep playing to improve!"}</p>
          <div className="flex justify-center gap-3">
            <Button onClick={startGame} className="bounty-gradient text-white border-0">Play Again</Button>
            <Link href="/dashboard/games"><Button variant="outline">All Games</Button></Link>
          </div>
        </div>
      )}
    </div>
  )
}
