"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const SIZE = 4
type Board = (number | null)[][]

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
}

function addRandom(board: Board): Board {
  const empty: [number, number][] = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!board[r][c]) empty.push([r, c])
  if (!empty.length) return board
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  const next = board.map(row => [...row]) as Board
  next[r][c] = Math.random() < 0.9 ? 2 : 4
  return next
}

function initBoard(): Board {
  return addRandom(addRandom(emptyBoard()))
}

function slideLeft(row: (number | null)[]): { row: (number | null)[]; gain: number } {
  const nums = row.filter(Boolean) as number[]
  let gain = 0
  const merged: number[] = []
  let i = 0
  while (i < nums.length) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const val = nums[i] * 2
      merged.push(val)
      gain += val
      i += 2
    } else {
      merged.push(nums[i])
      i++
    }
  }
  while (merged.length < SIZE) merged.push(0)
  return { row: merged.map(v => v || null), gain }
}

type Direction = "left" | "right" | "up" | "down"

function move(board: Board, dir: Direction): { board: Board; gain: number; moved: boolean } {
  let b = board.map(r => [...r]) as Board
  let totalGain = 0
  let moved = false

  const rotateRight = (b: Board): Board =>
    Array.from({ length: SIZE }, (_, r) =>
      Array.from({ length: SIZE }, (_, c) => b[SIZE - 1 - c][r])
    ) as Board

  const rotations        = { left: 0, up: 3, right: 2, down: 1 }
  const reverseRotations = { left: 0, up: 1, right: 2, down: 3 }

  for (let i = 0; i < rotations[dir]; i++) b = rotateRight(b)
  for (let r = 0; r < SIZE; r++) {
    const { row, gain } = slideLeft(b[r])
    if (row.some((v, c) => v !== b[r][c])) moved = true
    b[r] = row
    totalGain += gain
  }
  for (let i = 0; i < reverseRotations[dir]; i++) b = rotateRight(b)

  return { board: b, gain: totalGain, moved }
}

function hasMovesLeft(board: Board): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c]) return true
      if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return true
      if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return true
    }
  return false
}

// Enhanced tile colors with glow classes
const TILE_STYLES: Record<number, { bg: string; text: string; shadow: string }> = {
  2:    { bg: "bg-amber-50 dark:bg-amber-900/40",   text: "text-amber-900 dark:text-amber-100", shadow: "" },
  4:    { bg: "bg-amber-100 dark:bg-amber-800/50",  text: "text-amber-900 dark:text-amber-100", shadow: "" },
  8:    { bg: "bg-orange-300 dark:bg-orange-600",   text: "text-white", shadow: "shadow-md shadow-orange-500/30" },
  16:   { bg: "bg-orange-400",                      text: "text-white", shadow: "shadow-md shadow-orange-500/40" },
  32:   { bg: "bg-orange-500",                      text: "text-white", shadow: "shadow-md shadow-orange-600/40" },
  64:   { bg: "bg-red-500",                         text: "text-white", shadow: "shadow-md shadow-red-500/50" },
  128:  { bg: "bg-yellow-400",                      text: "text-white", shadow: "shadow-lg shadow-yellow-400/50" },
  256:  { bg: "bg-yellow-500",                      text: "text-white", shadow: "shadow-lg shadow-yellow-500/50" },
  512:  { bg: "bg-yellow-600",                      text: "text-white", shadow: "shadow-lg shadow-yellow-600/50" },
  1024: { bg: "bg-amber-600",                       text: "text-white", shadow: "shadow-xl shadow-amber-600/50" },
  2048: { bg: "bg-gradient-to-br from-amber-400 to-orange-500", text: "text-white", shadow: "shadow-xl shadow-orange-500/60" },
}

export default function Game2048Page() {
  const [board, setBoard]       = useState<Board>(initBoard)
  const [score, setScore]       = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [phase, setPhase]       = useState<"playing" | "won" | "lost">("playing")
  const [submitted, setSubmitted] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const scoreRef   = useRef(0)

  const saveSession = useCallback(async (finalScore: number) => {
    if (submitted) return
    setSubmitted(true)
    await fetch("/api/games/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_slug: "2048", score: finalScore, completed: true, metadata: { score: finalScore } }),
    })
  }, [submitted])

  const handleMove = useCallback((dir: Direction) => {
    if (phase !== "playing") return
    setBoard(prev => {
      const { board: next, gain, moved } = move(prev, dir)
      if (!moved) return prev

      scoreRef.current += gain
      const newScore = scoreRef.current
      setScore(newScore)
      setBestScore(b => Math.max(b, newScore))

      const won2048 = next.flat().some(v => v === 2048)
      const withNew = addRandom(next)

      if (won2048) {
        setPhase("won")
        toast.success("🎉 You reached 2048!")
        saveSession(newScore)
        return withNew
      }
      if (!hasMovesLeft(withNew)) {
        setPhase("lost")
        saveSession(newScore)
        return withNew
      }
      return withNew
    })
  }, [phase, saveSession])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
      }
      if (map[e.key]) { e.preventDefault(); handleMove(map[e.key]) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleMove])

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
    if (Math.abs(dx) > Math.abs(dy)) handleMove(dx > 0 ? "right" : "left")
    else handleMove(dy > 0 ? "down" : "up")
  }

  function restart() {
    scoreRef.current = 0
    setBoard(initBoard())
    setScore(0)
    setPhase("playing")
    setSubmitted(false)
  }

  function tileSize(val: number): string {
    if (val >= 1024) return "text-base"
    if (val >= 128)  return "text-lg"
    return "text-xl"
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto select-none">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-black text-amber-500 flex-1">2048</h1>
        <div className="flex gap-2">
          <div className="text-center bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5">
            <p className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">Score</p>
            <p className="text-sm font-black tabular-nums">{score.toLocaleString()}</p>
          </div>
          <div className="text-center bg-muted border border-border rounded-xl px-3 py-1.5">
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Best</p>
            <p className="text-sm font-black tabular-nums">{bestScore.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {phase === "playing" ? "Swipe or use arrow keys · merge tiles to reach 2048!" : ""}
      </p>

      {/* Game board */}
      <div
        className="rounded-2xl bg-amber-950/20 dark:bg-amber-900/10 border border-amber-500/20 p-2.5 touch-none shadow-xl shadow-amber-500/10"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {board.map((row, r) =>
            row.map((cell, c) => {
              const style = cell ? (TILE_STYLES[cell] ?? { bg: "bg-amber-800", text: "text-white text-sm", shadow: "shadow-xl shadow-amber-800/50" }) : null
              return (
                <div
                  key={`${r}-${c}`}
                  className={`aspect-square rounded-xl flex items-center justify-center font-black transition-all duration-100 ${
                    style
                      ? `${style.bg} ${style.text} ${style.shadow} ${tileSize(cell!)}`
                      : "bg-amber-500/5 border border-amber-500/10"
                  }`}
                >
                  {cell ?? ""}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* D-pad */}
      <div className="grid grid-cols-3 gap-2 mt-1 max-w-[180px] mx-auto">
        <div />
        <Button variant="outline" size="sm" onClick={() => handleMove("up")} className="font-bold border-amber-500/30 hover:border-amber-500">↑</Button>
        <div />
        <Button variant="outline" size="sm" onClick={() => handleMove("left")} className="font-bold border-amber-500/30 hover:border-amber-500">←</Button>
        <div />
        <Button variant="outline" size="sm" onClick={() => handleMove("right")} className="font-bold border-amber-500/30 hover:border-amber-500">→</Button>
        <div />
        <Button variant="outline" size="sm" onClick={() => handleMove("down")} className="font-bold border-amber-500/30 hover:border-amber-500">↓</Button>
        <div />
      </div>

      {/* Result */}
      {phase !== "playing" && (
        <div className={`rounded-2xl border p-6 text-center space-y-3 animate-bounce-in ${
          phase === "won"
            ? "border-amber-500/40 bg-amber-500/8"
            : "border-destructive/30 bg-destructive/8"
        }`}>
          {phase === "won" ? (
            <>
              <p className="text-3xl font-black text-amber-500">🏆 You reached 2048!</p>
              <p className="text-muted-foreground text-sm font-semibold">Final score: <span className="text-amber-500 font-black">{score.toLocaleString()}</span></p>
            </>
          ) : (
            <>
              <p className="text-xl font-black text-destructive">Game Over</p>
              <p className="text-muted-foreground text-sm">Final score: <strong className="text-foreground">{score.toLocaleString()}</strong></p>
            </>
          )}
          <div className="flex justify-center gap-2">
            <Button onClick={restart} className="bg-amber-500 hover:bg-amber-600 text-white border-0 font-bold shadow-md shadow-amber-500/30" size="sm">
              New Game
            </Button>
            <Link href="/dashboard/games"><Button variant="outline" size="sm">All Games</Button></Link>
          </div>
        </div>
      )}
    </div>
  )
}
