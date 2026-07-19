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
  return 100 + Math.floor(secondsLeft * 10)
}

interface Round { word: string; scrambled: string }

function buildRounds(): Round[] {
  const seed = Date.now()
  const pool = seededShuffle([...SCRAMBLE_WORDS], seed).slice(0, ROUNDS)
  return pool.map(word => ({ word, scrambled: scrambleWord(word) }))
}

function Stars({ correct }: { correct: number }) {
  const n = correct >= 9 ? 3 : correct >= 6 ? 2 : 1
  return (
    <div className="flex justify-center gap-1">
      {[1, 2, 3].map(i => (
        <span key={i} className={`text-2xl ${i <= n ? "" : "opacity-20 grayscale"}`}>⭐</span>
      ))}
    </div>
  )
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
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const timeLeftRef = useRef(SECONDS_PER_ROUND)
  const scoreRef   = useRef(0)
  const correctRef = useRef(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const advanceRound = useCallback((guess: string, currentRounds: Round[], currentIdx: number, currentTimeLeft: number) => {
    clearTimer()
    const round = currentRounds[currentIdx]
    const ok  = guess.toUpperCase() === round.word.toUpperCase()
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
      if (timeLeftRef.current <= 0) advanceRound("", rounds, idx, 0)
    }, 1000)
  }, [clearTimer, advanceRound])

  useEffect(() => {
    if (phase === "playing" && rounds.length) startTimer(rounds, roundIdx)
    return clearTimer
  }, [roundIdx, phase]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setRounds(newRounds); setRoundIdx(0); setAnswer("")
    setScore(0); setCorrect(0); setResults([]); setFeedback(null); setSubmitted(false)
    setTimeLeft(SECONDS_PER_ROUND); timeLeftRef.current = SECONDS_PER_ROUND
    scoreRef.current = 0; correctRef.current = 0
    setPhase("playing")
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function handleSubmit() {
    if (!answer.trim() || phase !== "playing" || feedback) return
    advanceRound(answer.trim(), rounds, roundIdx, timeLeftRef.current)
  }

  const currentRound = rounds[roundIdx]
  const timerPct   = (timeLeft / SECONDS_PER_ROUND) * 100
  const timerColor = timeLeft > 8 ? "bg-primary" : timeLeft > 4 ? "bg-amber-500" : "bg-destructive"

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex-1">🔤 Word Scramble</h1>
        {phase === "playing" && (
          <span className="text-xs text-muted-foreground font-medium tabular-nums">
            {roundIdx + 1} / {ROUNDS}
          </span>
        )}
      </div>

      {/* Idle */}
      {phase === "idle" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-pink-500/10 flex items-center justify-center text-4xl">🔤</div>
          <div>
            <h2 className="text-xl font-bold">Word Scramble</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
              Unscramble <strong>{ROUNDS} words</strong> — <strong>{SECONDS_PER_ROUND} seconds</strong> each.
              Answer faster for more points!
            </p>
          </div>
          {/* Sample tiles */}
          <div className="flex justify-center gap-2">
            {["P", "L", "A", "N", "E", "T"].map((ch, i) => (
              <div key={i} className="w-9 h-9 rounded-lg border-2 border-primary/20 bg-primary/5 flex items-center justify-center text-sm font-black text-primary shadow-sm">
                {ch}
              </div>
            ))}
          </div>
          <Button onClick={startGame} className="bounty-gradient text-white border-0 px-10">
            Start!
          </Button>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && currentRound && (
        <div className="space-y-5">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 justify-center flex-wrap">
            {Array.from({ length: ROUNDS }).map((_, i) => {
              const result = results[i]
              return (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i < results.length
                      ? result.ok ? "bg-emerald-500" : "bg-destructive"
                      : i === roundIdx
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              )
            })}
          </div>

          {/* Timer bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="font-medium">Word {roundIdx + 1} of {ROUNDS}</span>
              <span className={`font-bold flex items-center gap-1 ${timeLeft <= 5 ? "text-destructive animate-pulse" : ""}`}>
                <Timer className="w-3 h-3" />
                {timeLeft}s
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`${timerColor} rounded-full h-2 transition-all`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>

          {/* Score */}
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold">Score: <span className="text-primary tabular-nums">{score}</span></span>
            <span className="text-muted-foreground tabular-nums">{correct} / {roundIdx} correct</span>
          </div>

          {/* Letter tiles */}
          <div className={`rounded-xl border bg-card p-6 text-center transition-colors ${
            feedback === "correct" ? "border-emerald-500/40 bg-emerald-500/5"
            : feedback === "wrong"   ? "border-destructive/40 bg-destructive/5"
            : ""
          }`}>
            {feedback ? (
              <div className="space-y-2 animate-bounce-in">
                {feedback === "correct"
                  ? <CheckCircle className="w-9 h-9 text-emerald-500 mx-auto" />
                  : <XCircle className="w-9 h-9 text-destructive mx-auto" />
                }
                <p className="text-xl font-bold">{currentRound.word}</p>
                <p className="text-xs text-muted-foreground">
                  {feedback === "correct"
                    ? `+${scoreForAnswer(timeLeftRef.current + 1, true)} pts`
                    : "No points this round"}
                </p>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Unscramble this word</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {currentRound.scrambled.split("").map((ch, i) => (
                    <div
                      key={i}
                      className="w-11 h-11 rounded-xl border-2 border-primary/25 bg-primary/5 flex items-center justify-center text-lg font-black text-primary shadow-sm"
                    >
                      {ch}
                    </div>
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
                autoComplete="off"
              />
              <Button
                onClick={handleSubmit}
                className="bounty-gradient text-white border-0 px-4"
                disabled={!answer.trim()}
              >
                ✓
              </Button>
            </div>
          )}

          {!feedback && (
            <button
              onClick={() => advanceRound("", rounds, roundIdx, 0)}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
            >
              Skip →
            </button>
          )}
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="space-y-4 animate-bounce-in">
          <div className="rounded-xl border bg-card p-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-pink-500/10 flex items-center justify-center text-4xl">🔤</div>
            <div>
              <p className="text-5xl font-black tabular-nums">{score}</p>
              <p className="text-muted-foreground font-semibold mt-1">points</p>
            </div>
            <Stars correct={correct} />
            <p className="text-sm text-muted-foreground">
              {correct}/{ROUNDS} words correct
              {" · "}
              {score >= 1500 ? "🔥 Expert!" : score >= 900 ? "👏 Great job!" : "Keep practicing!"}
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={startGame} className="bounty-gradient text-white border-0">Play Again</Button>
              <Link href="/dashboard/games"><Button variant="outline">All Games</Button></Link>
            </div>
          </div>

          {/* Round results */}
          <div className="rounded-xl border bg-card overflow-hidden divide-y">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${r.ok ? "" : "bg-muted/30"}`}>
                {r.ok
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <XCircle className="w-4 h-4 text-destructive shrink-0" />
                }
                <span className="flex-1 text-sm font-semibold">{r.word}</span>
                {!r.ok && r.guess && (
                  <span className="text-xs text-muted-foreground line-through">{r.guess}</span>
                )}
                {!r.ok && !r.guess && (
                  <span className="text-xs text-muted-foreground italic">skipped</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
