"use client"
import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Calendar, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useGameEntry } from "@/hooks/useGameEntry"

const WORD_LENGTH = 5
const MAX_GUESSES = 6

type TileState = "empty" | "filled" | "correct" | "present" | "absent"
interface Tile { letter: string; state: TileState }

const KEY_PRIORITY: Record<TileState, number> = {
  empty:   0,
  filled:  0,
  absent:  1,
  present: 2,
  correct: 3,
}

const KEYBOARD_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
]

function scoreFromGuesses(guesses: number): number {
  const base = [600, 400, 300, 200, 150, 100]
  return base[Math.min(guesses - 1, base.length - 1)]
}

function WordleContent() {
  const { entryId, ensureEntry, submitSession } = useGameEntry("wordle")

  const [word, setWord]     = useState("")
  const [date, setDate]     = useState("")
  const [board, setBoard]   = useState<Tile[][]>(
    Array.from({ length: MAX_GUESSES }, () =>
      Array.from({ length: WORD_LENGTH }, () => ({ letter: "", state: "empty" as TileState }))
    )
  )
  const [currentRow, setCurrentRow]     = useState(0)
  const [currentCol, setCurrentCol]     = useState(0)
  const [gameOver, setGameOver]         = useState(false)
  const [won, setWon]                   = useState(false)
  const [keyStates, setKeyStates]       = useState<Record<string, TileState>>({})
  const [loading, setLoading]           = useState(true)
  const [loadError, setLoadError]       = useState<string | null>(null)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const [shakingRow, setShakingRow]     = useState<number | null>(null)
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set())
  const sessionSaved = useRef(false)
  const initEntryRef = useRef(false)

  const loadGame = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [seedRes, statsRes] = await Promise.all([
        fetch("/api/games/seed?game=wordle"),
        fetch("/api/games/my-stats"),
      ])
      if (!seedRes.ok) throw new Error("Failed to load today's puzzle")
      const seedJson = await seedRes.json()
      setWord(seedJson.word ?? "")
      setDate(seedJson.date ?? "")

      let playedToday = false
      if (statsRes.ok) {
        const statsJson = await statsRes.json()
        playedToday = Boolean(statsJson.data?.wordle?.completed_today)
        if (playedToday) setAlreadyPlayed(true)
      }

      if (!playedToday && !entryId && !initEntryRef.current) {
        initEntryRef.current = true
        await ensureEntry()
      }
    } catch {
      setLoadError("Could not load today's Wordle puzzle. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [entryId, ensureEntry])

  useEffect(() => {
    void loadGame()
  }, [loadGame])

  const saveSession = useCallback(async (completed: boolean, score: number, guessCount: number) => {
    if (sessionSaved.current) return
    sessionSaved.current = true
    await submitSession({
      score,
      completed,
      metadata: { word, guesses: guessCount, date },
    })
  }, [submitSession, word, date])

  const submitGuess = useCallback(() => {
    if (gameOver || currentRow >= MAX_GUESSES) return
    const guess = board[currentRow].map(t => t.letter).join("")
    if (guess.length < WORD_LENGTH) {
      toast.error("Not enough letters")
      setShakingRow(currentRow)
      setTimeout(() => setShakingRow(null), 500)
      return
    }

    const newBoard  = board.map(r => r.map(t => ({ ...t })))
    const wordArr   = word.split("")
    const guessArr  = guess.split("")
    const result: TileState[] = Array(WORD_LENGTH).fill("absent")
    const remaining: (string | null)[] = [...wordArr]

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessArr[i] === wordArr[i]) { result[i] = "correct"; remaining[i] = null }
    }
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === "correct") continue
      const idx = remaining.indexOf(guessArr[i])
      if (idx !== -1) { result[i] = "present"; remaining[idx] = null }
    }
    for (let i = 0; i < WORD_LENGTH; i++) newBoard[currentRow][i].state = result[i]
    setBoard(newBoard)
    setRevealedRows(prev => new Set([...prev, currentRow]))

    setKeyStates(prev => {
      const next = { ...prev }
      for (let i = 0; i < WORD_LENGTH; i++) {
        const key = guessArr[i]
        const current = next[key] ?? "empty"
        if (KEY_PRIORITY[result[i]] > KEY_PRIORITY[current]) {
          next[key] = result[i]
        }
      }
      return next
    })

    const isWin = result.every(r => r === "correct")
    if (isWin) {
      setWon(true); setGameOver(true)
      const score = scoreFromGuesses(currentRow + 1)
      toast.success(`🎉 Brilliant! +${score} pts`)
      void saveSession(true, score, currentRow + 1)
    } else if (currentRow + 1 >= MAX_GUESSES) {
      setGameOver(true)
      toast.error(`The word was ${word}`)
      void saveSession(true, 0, MAX_GUESSES)
    }

    setCurrentRow(r => r + 1)
    setCurrentCol(0)
  }, [board, currentRow, gameOver, word, saveSession])

  const handleKey = useCallback((key: string) => {
    if (gameOver || alreadyPlayed) return
    if (key === "ENTER") { submitGuess(); return }
    if (key === "⌫" || key === "BACKSPACE") {
      if (currentCol === 0) return
      const newBoard = board.map(r => r.map(t => ({ ...t })))
      newBoard[currentRow][currentCol - 1] = { letter: "", state: "empty" }
      setBoard(newBoard)
      setCurrentCol(c => c - 1)
      return
    }
    if (/^[A-Z]$/.test(key) && currentCol < WORD_LENGTH) {
      const newBoard = board.map(r => r.map(t => ({ ...t })))
      newBoard[currentRow][currentCol] = { letter: key, state: "filled" }
      setBoard(newBoard)
      setCurrentCol(c => c + 1)
    }
  }, [board, currentRow, currentCol, gameOver, alreadyPlayed, submitGuess])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      handleKey(e.key.toUpperCase())
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleKey])

  const tileStyle = (state: TileState, isRevealed: boolean) => {
    if (!isRevealed && state !== "empty" && state !== "filled") return "border-foreground/30 bg-transparent"
    return {
      empty:   "border-border/60 bg-transparent",
      filled:  "border-emerald-500/60 bg-emerald-500/5",
      correct: "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
      present: "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/30",
      absent:  "border-muted bg-muted/60 text-muted-foreground",
    }[state]
  }

  const keyColor: Record<TileState, string> = {
    empty:   "bg-muted hover:bg-muted/70 text-foreground",
    filled:  "bg-muted hover:bg-muted/70 text-foreground",
    correct: "bg-emerald-500 text-white hover:bg-emerald-600 shadow shadow-emerald-500/30",
    present: "bg-amber-500 text-white hover:bg-amber-600 shadow shadow-amber-500/30",
    absent:  "bg-muted/40 text-muted-foreground/50",
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  )

  if (loadError) return (
    <div className="flex flex-col items-center justify-center gap-4 max-w-sm mx-auto py-16 text-center">
      <AlertCircle className="w-10 h-10 text-destructive" />
      <p className="font-bold text-lg">Failed to load game</p>
      <p className="text-sm text-muted-foreground">{loadError}</p>
      <div className="flex gap-2">
        <Button onClick={() => void loadGame()} size="sm">Retry</Button>
        <Link href="/dashboard/games"><Button variant="outline" size="sm">All Games</Button></Link>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-5 max-w-sm mx-auto">
      {/* Header */}
      <div className="w-full flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-black text-xl text-emerald-600 dark:text-emerald-400">Daily Wordle</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {date}
          </p>
        </div>
        <div className="text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg px-2.5 py-1">
          {MAX_GUESSES - currentRow} left
        </div>
      </div>

      {alreadyPlayed && (
        <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-sm text-center text-emerald-700 dark:text-emerald-400 font-medium">
          ✅ You've already played today — come back tomorrow!
        </div>
      )}

      {/* Board */}
      <div className="grid gap-1.5">
        {board.map((row, ri) => (
          <div
            key={ri}
            className={`flex gap-1.5 ${ri === shakingRow ? "animate-shake" : ""}`}
          >
            {row.map((tile, ci) => (
              <div
                key={ci}
                className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-lg font-black uppercase transition-all duration-300
                  ${tileStyle(tile.state, revealedRows.has(ri))}`}
                style={
                  revealedRows.has(ri) && tile.state !== "empty" && tile.state !== "filled"
                    ? { transitionDelay: `${ci * 80}ms` }
                    : undefined
                }
              >
                {tile.letter}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Result banner */}
      {gameOver && (
        <div className={`w-full rounded-2xl px-5 py-4 text-center border animate-bounce-in ${
          won
            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        }`}>
          {won ? (
            <>
              <p className="font-black text-lg">🎉 You got it in {currentRow} {currentRow === 1 ? "try" : "tries"}!</p>
              <p className="text-sm mt-1 opacity-80 font-semibold">+{scoreFromGuesses(currentRow)} points earned</p>
            </>
          ) : (
            <>
              <p className="font-black text-lg">😔 Better luck tomorrow!</p>
              <p className="text-sm mt-1 opacity-80">The word was <strong className="uppercase">{word}</strong></p>
            </>
          )}
          <Link href="/dashboard/games" className="inline-block mt-3">
            <Button variant="outline" size="sm">← All Games</Button>
          </Link>
        </div>
      )}

      {/* Keyboard */}
      <div className="w-full space-y-1.5">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1">
            {row.map(key => {
              const isWide = key === "ENTER" || key === "⌫"
              return (
                <button
                  key={key}
                  onClick={() => handleKey(key)}
                  disabled={alreadyPlayed}
                  className={`${
                    isWide
                      ? "flex-[1.5] min-w-0 max-w-[56px] px-1 text-xs"
                      : "flex-1 min-w-0 max-w-[36px] text-sm"
                  } h-11 rounded-lg font-bold transition-all
                    ${keyColor[keyStates[key] ?? "empty"]}
                    disabled:opacity-40 active:scale-95`}
                >
                  {key}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WordlePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" /></div>}>
      <WordleContent />
    </Suspense>
  )
}
