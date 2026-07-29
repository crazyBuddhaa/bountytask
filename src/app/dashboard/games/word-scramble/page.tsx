"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
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
    <div className="flex justify-center gap-1.5">
      {[1, 2, 3].map(i => (
        <span key={i} className={`text-2xl ${i <= n ? "" : "opacity-20 grayscale"}`}>⭐</span>
      ))}
    </div>
  )
}

export default function WordScramblePage() {
  const [phase, setPhase]     = useState<"idle" | "playing" | "done">("idle")
  const [rounds, setRounds]   = useState<Round[]>([])
  const [roundIdx, setRoundIdx] = useState(0)
  const [answer, setAnswer]   = useState("")
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_ROUND)
  const [score, setScore]     = useState(0)
  const [correct, setCorrect] = useState(0)
  const [results, setResults] = useState<{ word: string; guess: string; ok: boolean }[]>([])
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const timeLeftRef = useRef(SECONDS_PER_ROUND)
  const scoreRef    = useRef(0)
  const correctRef  = useRef(0)

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
  const urgency    = timeLeft <= 5
  const timerColor = timeLeft > 8 ? "bg-pink-500" : timeLeft > 4 ? "bg-amber-500" : "bg-destructive"

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black text-pink-500">Word Scramble</h1>
        </div>
        {phase === "playing" && (
          <span className="text-xs text-muted-foreground font-bold tabular-nums bg-muted rounded-lg px-2.5 py-1">
            {roundIdx + 1} / {ROUNDS}
          </span>
        )}
      </div>

      {/* Idle */}
      {phase === "idle" && (
        <div className="rounded-2xl overflow-hidden border border-pink-500/30 bg-card">
          <div className="relative h-48">
            <Image src="/games/word-scramble.jpg" alt="Word Scramble" fill className="object-cover" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-5 right-5">
              <h2 className="text-2xl font-black text-white">Word Scramble</h2>
              <p className="text-white/70 text-sm mt-0.5">Unscramble as fast as you can</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <p className="text-muted-foreground text-sm text-center">
              Unscramble <strong className="text-foreground">{ROUNDS} words</strong> —{" "}
              <strong className="text-foreground">{SECONDS_PER_ROUND} seconds</strong> each.
              Answer faster for more points!
            </p>
            {/* Sample tiles */}
            <div className="flex justify-center gap-2">
              {["P", "L", "A", "N", "E", "T"].map((ch, i) => (
                <div key={i} className="w-10 h-10 rounded-xl border-2 border-pink-500/30 bg-pink-500/8 flex items-center justify-center text-sm font-black text-pink-500 shadow-sm">
                  {ch}
                </div>
              ))}
            </div>
            <Button onClick={startGame} className="w-full bg-pink-500 hover:bg-pink-600 text-white border-0 font-black text-base py-6 shadow-lg shadow-pink-500/30">
              Start!
            </Button>
          </div>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && currentRound && (
        <div className="space-y-4">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 justify-center flex-wrap">
            {Array.from({ length: ROUNDS }).map((_, i) => {
              const result = results[i]
              return (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i < results.length
                      ? result.ok ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-destructive"
                      : i === roundIdx
                      ? "bg-pink-500 scale-125 shadow-sm shadow-pink-500/50"
                      : "bg-muted"
                  }`}
                />
              )
            })}
          </div>

          {/* Timer bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-medium">Word {roundIdx + 1} of {ROUNDS}</span>
              <span className={`font-black flex items-center gap-1 tabular-nums ${urgency ? "text-destructive animate-pulse" : "text-pink-500"}`}>
                <Timer className="w-3 h-3" />
                {timeLeft}s
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={`${timerColor} rounded-full h-2.5 transition-all shadow-sm`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>

          {/* Score */}
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold">Score: <span className="text-pink-500 font-black tabular-nums">{score}</span></span>
            <span className="text-muted-foreground tabular-nums">{correct} / {roundIdx} correct</span>
          </div>

          {/* Letter tiles */}
          <div className={`rounded-2xl border bg-card p-6 text-center transition-all ${
            feedback === "correct" ? "border-emerald-500/50 bg-emerald-500/8 shadow-lg shadow-emerald-500/10"
            : feedback === "wrong"   ? "border-destructive/40 bg-destructive/5"
            : "border-pink-500/20"
          }`}>
            {feedback ? (
              <div className="space-y-2 animate-bounce-in">
                {feedback === "correct"
                  ? <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                  : <XCircle className="w-10 h-10 text-destructive mx-auto" />
                }
                <p className="text-2xl font-black">{currentRound.word}</p>
                <p className="text-xs text-muted-foreground font-semibold">
                  {feedback === "correct"
                    ? `+${scoreForAnswer(timeLeftRef.current + 1, true)} pts`
                    : "No points this round"}
                </p>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4 font-bold">Unscramble this word</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {currentRound.scrambled.split("").map((ch, i) => (
                    <div
                      key={i}
                      className="w-11 h-11 rounded-xl border-2 border-pink-500/30 bg-pink-500/8 flex items-center justify-center text-lg font-black text-pink-500 shadow-sm"
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
                className="text-center text-lg font-black uppercase tracking-widest border-pink-500/30 focus:border-pink-500"
                maxLength={currentRound.word.length + 2}
                autoComplete="off"
              />
              <Button onClick={handleSubmit} className="bg-pink-500 hover:bg-pink-600 text-white border-0 font-bold px-5 shadow-md shadow-pink-500/30">
                Go
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="rounded-2xl border border-pink-500/30 bg-card overflow-hidden animate-bounce-in">
          <div className="relative h-32 overflow-hidden">
            <Image src="/games/word-scramble.jpg" alt="" fill className="object-cover opacity-50" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
          </div>
          <div className="px-6 pb-6 -mt-8 relative text-center space-y-4">
            <p className="text-6xl font-black tabular-nums text-pink-500 drop-shadow-lg">{score}</p>
            <p className="text-muted-foreground font-bold -mt-2">points</p>
            <Stars correct={correct} />
            <p className="text-sm font-semibold">
              {correct} / {ROUNDS} words correct
            </p>
            <p className="text-sm text-muted-foreground">
              {correct >= 9 ? "🔥 Word wizard!" : correct >= 6 ? "👏 Well done!" : "Keep practising!"}
            </p>
            {/* Results breakdown */}
            <div className="text-left rounded-xl border border-border bg-muted/30 overflow-hidden max-h-48 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-0 ${r.ok ? "" : "bg-destructive/5"}`}>
                  <span className={`text-xs font-bold uppercase tracking-wide ${r.ok ? "text-foreground" : "text-destructive"}`}>{r.word}</span>
                  <div className="flex items-center gap-1.5">
                    {r.ok
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      : <XCircle className="w-3.5 h-3.5 text-destructive" />
                    }
                    {!r.ok && r.guess && <span className="text-xs text-muted-foreground line-through">{r.guess}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-3 pt-1">
              <Button onClick={startGame} className="bg-pink-500 hover:bg-pink-600 text-white border-0 font-bold shadow-md shadow-pink-500/30">Play Again</Button>
              <Link href="/dashboard/games"><Button variant="outline">All Games</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
