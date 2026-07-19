"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const WORD_LENGTH = 5
const MAX_GUESSES = 6

type TileState = "empty" | "filled" | "correct" | "present" | "absent"
interface Tile { letter: string; state: TileState }

const KEYBOARD_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
]

function scoreFromGuesses(guesses: number): number {
  const base = [600, 400, 300, 200, 150, 100]
  return base[Math.min(guesses - 1, base.length - 1)]
}

export default function WordlePage() {
  const [word, setWord] = useState("")
  const [date, setDate] = useState("")
  const [board, setBoard] = useState<Tile[][]>(
    Array.from({ length: MAX_GUESSES }, () =>
      Array.from({ length: WORD_LENGTH }, () => ({ letter: "", state: "empty" as TileState }))
    )
  )
  const [currentRow, setCurrentRow] = useState(0)
  const [currentCol, setCurrentCol] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [keyStates, setKeyStates] = useState<Record<string, TileState>>({})
  const [loading, setLoading] = useState(true)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const [shakingRow, setShakingRow] = useState<number | null>(null)
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set())
  const sessionSaved = useRef(false)

  useEffect(() => {
    fetch("/api/games/seed?game=wordle")
      .then(r => r.json())
      .then(j => { setWord(j.word ?? ""); setDate(j.date ?? ""); setLoading(false) })
    fetch("/api/games/my-stats")
      .then(r => r.json())
      .then(j => { if (j.data?.wordle?.completed_today) setAlreadyPlayed(true) })
  }, [])

  const saveSession = useCallback(async (completed: boolean, score: number, guessCount: number) => {
    if (sessionSaved.current) return
    sessionSaved.current = true
    await fetch("/api/games/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_slug: "wordle", score, completed, metadata: { word, guesses: guessCount, date } }),
    })
  }, [word, date])

  const submitGuess = useCallback(() => {
    if (gameOver || currentRow >= MAX_GUESSES) return
    const guess = board[currentRow].map(t => t.letter).join("")
    if (guess.length < WORD_LENGTH) {
      toast.error("Not enough letters")
      setShakingRow(currentRow)
      setTimeout(() => setShakingRow(null), 500)
      return
    }

    const newBoard = board.map(r => r.map(t => ({ ...t })))
    const wordArr  = word.split("")
    const guessArr = guess.split("")
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
        if (next[key] !== "correct") next[key] = result[i]
      }
      return next
    })

    const isWin = result.every(r => r === "correct")
    if (isWin) {
      setWon(true); setGameOver(true)
      const score = scoreFromGuesses(currentRow + 1)
      toast.success(`🎉 Brilliant! +${score} pts`)
      saveSession(true, score, currentRow + 1)
    } else if (currentRow + 1 >= MAX_GUESSES) {
      setGameOver(true)
      toast.error(`The word was ${word}`)
      saveSession(false, 0, MAX_GUESSES)
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
    const handler = (e: KeyboardEvent) => handleKey(e.key.toUpperCase())
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleKey])

  // Tile styles
  const tileStyle = (state: TileState, isRevealed: boolean) => {
    if (!isRevealed && state !== "empty" && state !== "filled") return "border-foreground/30 bg-transparent"
    return {
      empty:   "border-border/60 bg-transparent",
      filled:  "border-foreground/50 bg-transparent",
      correct: "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20",
      present: "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20",
      absent:  "border-muted bg-muted/60 text-muted-foreground",
    }[state]
  }

  const keyColor: Record<TileState, string> = {
    empty:   "bg-muted hover:bg-muted/70",
    filled:  "bg-muted hover:bg-muted/70",
    correct: "bg-emerald-500 text-white hover:bg-emerald-600",
    present: "bg-amber-500 text-white hover:bg-amber-600",
    absent:  "bg-muted/40 text-muted-foreground/50 hover:bg-muted/50",
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
      {/* Header */}
      <div className="w-full flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex-1">🟩 Daily Wordle</h1>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>

      {alreadyPlayed && (
        <div className="w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-center text-muted-foreground">
          You've already played today — come back tomorrow for a new word!
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
                className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-lg font-bold uppercase transition-colors duration-300
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
        <div className={`w-full rounded-xl px-4 py-4 text-center border animate-bounce-in ${
          won
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        }`}>
          {won
            ? <>
                <p className="font-bold">🎉 You got it in {currentRow} {currentRow === 1 ? "try" : "tries"}!</p>
                <p className="text-sm mt-0.5 opacity-80">+{scoreFromGuesses(currentRow)} points earned</p>
              </>
            : <>
                <p className="font-bold">😔 Better luck tomorrow!</p>
                <p className="text-sm mt-0.5 opacity-80">The word was <strong>{word}</strong></p>
              </>
          }
        </div>
      )}

      {/* Keyboard */}
      <div className="w-full space-y-1.5">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1">
            {row.map(key => (
              <button
                key={key}
                onClick={() => handleKey(key)}
                disabled={alreadyPlayed}
                className={`${key.length > 1 ? "px-2 text-xs min-w-[3.2rem]" : "w-9"} h-11 rounded-lg font-semibold text-sm transition-colors
                  ${keyColor[keyStates[key] ?? "empty"]}
                  disabled:opacity-40 active:scale-95`}
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
