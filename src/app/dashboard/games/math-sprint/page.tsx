"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Flame, Loader2, Play, RotateCcw, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGameEntry } from "@/hooks/useGameEntry"

const DURATION_SECONDS = 45

interface MathQuestion {
  prompt: string
  answer: number
  choices: number[]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function generateQuestion(solvedCount: number): MathQuestion {
  // Progressive difficulty: starts with simple +/- then introduces × and ÷
  const tier = solvedCount < 5 ? 1 : solvedCount < 12 ? 2 : 3
  let a = 0
  let b = 0
  let answer = 0
  let prompt = ""

  if (tier === 1) {
    const isAdd = Math.random() < 0.6
    if (isAdd) {
      a = randInt(4, 24)
      b = randInt(3, 19)
      answer = a + b
      prompt = `${a} + ${b}`
    } else {
      a = randInt(12, 35)
      b = randInt(3, a - 2)
      answer = a - b
      prompt = `${a} − ${b}`
    }
  } else if (tier === 2) {
    const roll = Math.random()
    if (roll < 0.35) {
      a = randInt(14, 55)
      b = randInt(11, 45)
      answer = a + b
      prompt = `${a} + ${b}`
    } else if (roll < 0.65) {
      a = randInt(25, 75)
      b = randInt(11, a - 5)
      answer = a - b
      prompt = `${a} − ${b}`
    } else {
      a = randInt(3, 12)
      b = randInt(3, 12)
      answer = a * b
      prompt = `${a} × ${b}`
    }
  } else {
    const roll = Math.random()
    if (roll < 0.25) {
      a = randInt(28, 95)
      b = randInt(17, 79)
      answer = a + b
      prompt = `${a} + ${b}`
    } else if (roll < 0.5) {
      a = randInt(45, 130)
      b = randInt(18, a - 9)
      answer = a - b
      prompt = `${a} − ${b}`
    } else if (roll < 0.8) {
      a = randInt(6, 15)
      b = randInt(4, 14)
      answer = a * b
      prompt = `${a} × ${b}`
    } else {
      b = randInt(3, 12)
      answer = randInt(4, 15)
      a = b * answer
      prompt = `${a} ÷ ${b}`
    }
  }

  // Generate 3 plausible distractors (never equal to answer or each other)
  const distractors = new Set<number>()
  const offsets = [-10, -5, -3, -2, -1, 1, 2, 3, 5, 10, -4, 4, -6, 6]
  while (distractors.size < 3) {
    const offset = offsets[Math.floor(Math.random() * offsets.length)]
    const candidate = answer + offset
    if (candidate >= 0 && candidate !== answer) {
      distractors.add(candidate)
    }
  }

  return {
    prompt,
    answer,
    choices: shuffle([answer, ...Array.from(distractors)]),
  }
}

function getMultiplier(streak: number): number {
  if (streak >= 12) return 4
  if (streak >= 7) return 3
  if (streak >= 3) return 2
  return 1
}

function MathSprintInner() {
  const { entering, ensureEntry, submitSession } = useGameEntry("math-sprint")

  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle")
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [question, setQuestion] = useState<MathQuestion>(() => generateQuestion(0))
  const [feedback, setFeedback] = useState<{ choice: number; ok: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const wrongRef = useRef(0)
  const bestStreakRef = useRef(0)
  const startedAtRef = useRef(0)
  const phaseRef = useRef<"idle" | "playing" | "done">("idle")

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
  }, [])

  const finishGame = useCallback(async () => {
    clearTimers()
    if (phaseRef.current === "done") return
    phaseRef.current = "done"
    setPhase("done")
    setSaving(true)
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
    await submitSession({
      score: scoreRef.current,
      completed: true,
      duration_seconds: durationSeconds,
      metadata: {
        correct: correctRef.current,
        wrong: wrongRef.current,
        best_streak: bestStreakRef.current,
      },
    })
    setSaving(false)
  }, [clearTimers, submitSession])

  const startGame = useCallback(async () => {
    const ok = await ensureEntry()
    if (!ok) return

    clearTimers()
    scoreRef.current = 0
    correctRef.current = 0
    wrongRef.current = 0
    bestStreakRef.current = 0
    startedAtRef.current = Date.now()
    phaseRef.current = "playing"

    setScore(0)
    setStreak(0)
    setBestStreak(0)
    setCorrectCount(0)
    setWrongCount(0)
    setTimeLeft(DURATION_SECONDS)
    setFeedback(null)
    setQuestion(generateQuestion(0))
    setPhase("playing")

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          void finishGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearTimers, ensureEntry, finishGame])

  const handleAnswer = useCallback(
    (choice: number) => {
      if (phaseRef.current !== "playing" || feedback !== null) return
      const ok = choice === question.answer
      setFeedback({ choice, ok })

      if (ok) {
        const nextStreak = streak + 1
        const mult = getMultiplier(nextStreak)
        const gain = 20 * mult
        scoreRef.current += gain
        correctRef.current += 1
        if (nextStreak > bestStreakRef.current) {
          bestStreakRef.current = nextStreak
          setBestStreak(nextStreak)
        }
        setScore(scoreRef.current)
        setStreak(nextStreak)
        setCorrectCount(correctRef.current)
      } else {
        wrongRef.current += 1
        setStreak(0)
        setWrongCount(wrongRef.current)
      }

      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null)
        setQuestion(generateQuestion(correctRef.current))
      }, ok ? 160 : 320)
    },
    [feedback, question.answer, streak]
  )

  // Keyboard shortcuts 1-4 during gameplay
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (phaseRef.current !== "playing" || e.ctrlKey || e.metaKey || e.altKey) return
      const idx = ["1", "2", "3", "4"].indexOf(e.key)
      if (idx !== -1 && question.choices[idx] !== undefined) {
        e.preventDefault()
        handleAnswer(question.choices[idx])
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleAnswer, question.choices])

  useEffect(() => clearTimers, [clearTimers])

  const multiplier = getMultiplier(streak)
  const totalAttempts = correctCount + wrongCount
  const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0
  const progressPct = Math.max(0, Math.min(100, (timeLeft / DURATION_SECONDS) * 100))

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/games"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All games
        </Link>
        <Link
          href="/dashboard/games/leaderboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          Leaderboard
        </Link>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quick Math Blitz</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          45 seconds · build streaks for up to ×4 points per answer
        </p>
      </div>

      {phase === "idle" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-lg font-bold tabular-nums">45s</p>
              <p className="text-[11px] text-muted-foreground">Time limit</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-lg font-bold tabular-nums">×4</p>
              <p className="text-[11px] text-muted-foreground">Max streak</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-lg font-bold tabular-nums">1–4</p>
              <p className="text-[11px] text-muted-foreground">Tap or keys</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Questions scale from addition and subtraction to multiplication and division as
            you solve more. A wrong answer resets your streak multiplier to ×1.
          </p>

          <Button size="lg" className="w-full" onClick={() => void startGame()} disabled={entering}>
            {entering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Start Blitz
          </Button>
        </div>
      )}

      {phase === "playing" && (
        <div className="space-y-4">
          {/* HUD */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Score</p>
              <p className="text-xl font-bold tabular-nums mt-0.5">{score.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Streak</p>
              <p className="text-xl font-bold tabular-nums mt-0.5 flex items-center gap-1">
                {streak}
                {multiplier > 1 && (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5 ml-1">
                    <Flame className="w-3.5 h-3.5" />×{multiplier}
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Time</p>
              <p
                className={`text-xl font-bold tabular-nums mt-0.5 ${
                  timeLeft <= 10 ? "text-destructive" : "text-foreground"
                }`}
              >
                {timeLeft}s
              </p>
            </div>
          </div>

          {/* Time bar */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 linear ${
                timeLeft <= 10 ? "bg-destructive" : "bg-primary"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Equation card */}
          <div className="rounded-xl border border-border bg-card py-10 px-6 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Solve
            </p>
            <p className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
              {question.prompt} = ?
            </p>
          </div>

          {/* 2x2 Thumb-friendly answer grid */}
          <div className="grid grid-cols-2 gap-3">
            {question.choices.map((choice, idx) => {
              const isSelected = feedback?.choice === choice
              const isCorrectAnswer = feedback && choice === question.answer
              let stateClass =
                "border-border bg-card hover:border-primary/60 hover:bg-muted/40 text-foreground"
              if (isSelected && feedback?.ok) {
                stateClass =
                  "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              } else if (isSelected && !feedback?.ok) {
                stateClass = "border-destructive bg-destructive/15 text-destructive"
              } else if (isCorrectAnswer) {
                stateClass =
                  "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              }

              return (
                <button
                  key={`${question.prompt}-${choice}`}
                  type="button"
                  onClick={() => handleAnswer(choice)}
                  disabled={feedback !== null}
                  className={`relative rounded-xl border-2 py-5 px-4 text-2xl font-bold tabular-nums transition-colors active:scale-[0.98] ${stateClass}`}
                >
                  <span className="absolute top-2 left-3 text-[10px] font-mono text-muted-foreground">
                    {idx + 1}
                  </span>
                  {choice}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5 text-center">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Time&apos;s up</p>
            <p className="text-4xl font-bold tabular-nums mt-1">{score.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {saving ? "Saving score to leaderboard…" : "Score recorded"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {correctCount}
              </p>
              <p className="text-[11px] text-muted-foreground">Correct</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-base font-bold tabular-nums">{accuracy}%</p>
              <p className="text-[11px] text-muted-foreground">Accuracy</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-base font-bold tabular-nums">{bestStreak}</p>
              <p className="text-[11px] text-muted-foreground">Best streak</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => void startGame()} disabled={entering}>
              {entering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Play Again
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/dashboard/games/leaderboard">Leaderboard</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MathSprintPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        </div>
      }
    >
      <MathSprintInner />
    </Suspense>
  )
}
