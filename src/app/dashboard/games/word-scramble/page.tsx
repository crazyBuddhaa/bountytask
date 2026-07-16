"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Timer, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { SCRAMBLE_WORDS, scrambleWord, seededShuffle } from "@/lib/games"

const ROUNDS = 10
const SECONDS_PER_ROUND = 15

function scoreForAnswer(secondsLeft: number, correct: boolean): number {
  if (!correct) return 0
  return 100 + Math.floor(secondsLeft * 10) // 100 base + up to 150 speed bonus
}

interface Round {
  word: string
  scrambled: string
}

function buildRounds(): Round[] {
  const seed = Date.now()
  const pool = seededShuffle([...SCRAMBLE_WORDS], seed).slice(0, ROUNDS)
  return pool.map(word => ({ word, scrambled: scrambleWord(word) }))
}

export default function WordScramblePage() {
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle")
  const [rounds, setRounds] = useState<Round[]>([])
  const [roundIdx, setRoundIdx] = useState(0)
  const [answer, setAnswer] = useState("")
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_ROUND)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [results, setResults] = useState<{ word: string; guess: string; ok: boolean }[]>([])
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeLeftRef = useRef(SECONDS_PER_ROUND)
  const scoreRef = useRef(0)
  const correctRef = useRef(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const advanceRound = useCallback((guess: string, currentRounds: Round[], currentIdx: number, currentTimeLeft: number) => {
    clearTimer()
    const round = currentRounds[currentIdx]
    const ok = guess.toUpperCase() === round.word.toUpperCase()
    const pts = scoreForAnswer(currentTimeLeft, ok)

    scoreRef.current += pts
    if (ok) correctRef.current++

    setScore(scoreRef.current)
    setCorrect(correctRef.current)
    setFeedback(ok ? "correct" : "wrong")
    setResults(prev => [...prev, { word: round.word, guess, ok }])

    setTimeout(() => {
      setFeedback(null)
      setAnswer("")
      if (currentIdx + 1 >= ROUNDS) {
        setPhase("done")
      } else {
        setRoundIdx(currentIdx + 1)
        setTimeLeft(SECONDS_PER_ROUND)
        timeLeftRef.current = SECONDS_PER_ROUND
        inputRef.current?.focus()
      }
    }, 800)
  }, [clearTimer])

  const startTimer = useCallback((rounds: Round[], idx: number) => {
    clearTimer()
    timerRef.current = setInterval(() => {
      timeLeftRef.current--
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 0) {
        advanceRound("", rounds, idx, 0)
      }
    }, 1000)
  }, [clearTimer, advanceRound])

  // Restart timer when roundIdx changes during play
  useEffect(() => {
    if (phase === "playing" && rounds.length) {
      startTimer(rounds, roundIdx)
    }
    return clearTimer
  }, [roundIdx, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save session when done
  useEffect(() => {
    if (phase === "done" && !submitted) {
      setSubmitted(true)
      fetch("/api/games/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_slug: "word-scramble",
          score: scoreRef.current,
          completed: true,
          duration_seconds: ROUNDS * SECONDS_PER_ROUND,
          metadata: { correct: correctRef.current, rounds: ROUNDS },
        }),
      })
    }
  }, [phase, submitted])

  useEffect(() => () => clearTimer(), [clearTimer])

  function startGame() {
    const newRounds = buildRounds()
    setRounds(newRounds)
    setRoundIdx(0)
    setAnswer("")
    setScore(0)
    setCorrect(0)
    setResults([])
    setFeedback(null)
    setSubmitted(false)
    setTimeLeft(SECONDS_PER_ROUND)
    timeLeftRef.current = SECONDS_PER_ROUND
    scoreRef.current = 0
    correctRef.current = 0
    setPhase("playing")
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function handleSubmit() {
    if (!answer.trim() || phase !== "playing") return
    advanceRound(answer.trim(), rounds, roundIdx, timeLeftRef.current)
  }

  function handleSkip() {
    advanceRound("", rounds, roundIdx, 0)
  }

  const currentRound = rounds[roundIdx]
  const timerPct = (timeLeft / SECONDS_PER_ROUND) * 100
  const timerColor = timeLeft > 8 ? "bg-primary" : timeLeft > 4 ? "bg-amber-500" : "bg-destructive"

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex-1">🔤 Word Scramble</h1>
        {phase === "playing" && (
          <div className="text-xs text-muted-foreground font-medium">
            {roundIdx + 1}/{ROUNDS}
          </div>
        )}
      </div>

      {phase === "idle" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-5xl">🔤</p>
          <h2 className="text-xl font-bold">Word Scramble</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Unscramble <strong>{ROUNDS}</strong> words, <strong>{SECONDS_PER_ROUND} seconds</strong> each.<br />
            Faster correct answers = more points!
          </p>
          <Button onClick={startGame} className="bounty-gradient text-white border-0 px-8">
            Start!
          </Button>
        </div>
      )}

      {phase === "playing" && currentRound && (
        <div className="space-y-5">
          {/* Timer bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Word {roundIdx + 1} of {ROUNDS}</span>
              <span className={`font-bold flex items-center gap-1 ${timeLeft <= 5 ? "text-destructive" : ""}`}>
                <Timer className="w-3 h-3" />{timeLeft}s
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className={`${timerColor} rounded-full h-2 transition-all`} style={{ width: `${timerPct}%` }} />
            </div>
          </div>

          {/* Score */}
          <div className="flex justify-between text-sm">
            <span className="font-bold">Score: <span className="text-primary">{score}</span></span>
            <span className="text-muted-foreground">{correct}/{roundIdx} correct</span>
          </div>

          {/* Scrambled word */}
          <div className={`rounded-xl border bg-card p-6 text-center transition-all ${
            feedback === "correct" ? "border-emerald-500/50 bg-emerald-500/10"
            : feedback === "wrong" ? "border-destructive/50 bg-destructive/10"
            : ""
          }`}>
            {feedback ? (
              <div className="space-y-2">
                {feedback === "correct"
                  ? <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                  : <XCircle className="w-8 h-8 text-destructive mx-auto" />
                }
                <p className="text-lg font-bold">{currentRound.word}</p>
                <p className="text-xs text-muted-foreground">
                  {feedback === "correct" ? `+${scoreForAnswer(timeLeftRef.current + 1, true)} pts` : "No points"}
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest">Unscramble this word</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {currentRound.scrambled.split("").map((ch, i) => (
                    <span key={i} className="w-10 h-10 rounded-lg border-2 border-primary/30 bg-primary/5 flex items-center justify-center text-lg font-black text-primary">
                      {ch}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Input */}
          {!feedback && (
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Type the word…"
                value={answer}
                onChange={e => setAnswer(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                className="text-center text-lg font-bold uppercase tracking-widest"
                maxLength={currentRound.word.length + 2}
              />
              <Button onClick={handleSubmit} className="bounty-gradient text-white border-0" disabled={!answer.trim()}>
                ✓
              </Button>
            </div>
          )}

          {!feedback && (
            <button onClick={handleSkip} className="w-full text-xs text-muted-foreground hover:text-foreground text-center">
              Skip this word →
            </button>
          )}
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-8 text-center space-y-3">
            <p className="text-5xl">🔤</p>
            <h2 className="text-2xl font-black">{score} points!</h2>
            <p className="text-muted-foreground text-sm">
              {correct}/{ROUNDS} correct · {score >= 1500 ? "🔥 Expert!" : score >= 900 ? "👏 Great!" : "Keep practicing!"}
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={startGame} className="bounty-gradient text-white border-0">Play Again</Button>
              <Link href="/dashboard/games"><Button variant="outline">All Games</Button></Link>
            </div>
          </div>

          {/* Round-by-round results */}
          <div className="rounded-xl border bg-card divide-y">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                {r.ok
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-destructive shrink-0" />
                }
                <span className="flex-1 text-sm font-medium">{r.word}</span>
                {!r.ok && r.guess && (
                  <span className="text-xs text-muted-foreground line-through">{r.guess}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
