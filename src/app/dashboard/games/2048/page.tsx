"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
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

  const rotations = { left: 0, up: 1, right: 2, down: 3 }
  const reverseRotations = { left: 0, up: 3, right: 2, down: 1 }

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

const TILE_COLORS: Record<number, string> = {
  2:    "bg-amber-100 text-amber-900 text-xl",
  4:    "bg-amber-200 text-amber-900 text-xl",
  8:    "bg-orange-300 text-white text-xl",
  16:   "bg-orange-400 text-white text-xl",
  32:   "bg-orange-500 text-white text-xl",
  64:   "bg-red-500 text-white text-xl",
  128:  "bg-yellow-400 text-white text-lg",
  256:  "bg-yellow-500 text-white text-lg",
  512:  "bg-yellow-600 text-white text-lg",
  1024: "bg-amber-600 text-white text-base",
  2048: "bg-amber-700 text-white text-base font-black",
}

export default function Game2048Page() {
  const [board, setBoard] = useState<Board>(initBoard)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [phase, setPhase] = useState<"playing" | "won" | "lost">("playing")
  const [submitted, setSubmitted] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const saveSession = useCallback(async (finalScore: number) => {
    if (submitted) return
    setSubmitted(true)
    await fetch("/api/games/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_slug: "2048",
        score: finalScore,
        completed: true,
        metadata: { score: finalScore },
      }),
    })
  }, [submitted])

  const handleMove = useCallback((dir: Direction) => {
    if (phase !== "playing") return
    setBoard(prev => {
      const { board: next, gain, moved } = move(prev, dir)
      if (!moved) return prev

      const newScore = score + gain
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
  }, [phase, score, saveSession])

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
    setBoard(initBoard())
    setScore(0)
    setPhase("playing")
    setSubmitted(false)
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto select-none">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex-1">🧮 2048</h1>
        <div className="flex gap-2">
          <div className="text-center bg-muted rounded-lg px-3 py-1">
            <p className="text-[10px] text-muted-foreground">SCORE</p>
            <p className="text-sm font-bold">{score}</p>
          </div>
          <div className="text-center bg-muted rounded-lg px-3 py-1">
            <p className="text-[10px] text-muted-foreground">BEST</p>
            <p className="text-sm font-bold">{bestScore}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {phase === "playing" ? "Swipe or use arrow keys to merge tiles → reach 2048!" : ""}
      </p>

      {/* Game board */}
      <div
        className="rounded-xl bg-muted p-2 touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {board.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className={`aspect-square rounded-lg flex items-center justify-center font-bold transition-colors ${
                  cell
                    ? TILE_COLORS[cell] ?? "bg-amber-800 text-white text-sm"
                    : "bg-muted-foreground/10"
                }`}
              >
                {cell ?? ""}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2 mt-1">
        <div />
        <Button variant="outline" size="sm" onClick={() => handleMove("up")}>↑</Button>
        <div />
        <Button variant="outline" size="sm" onClick={() => handleMove("left")}>←</Button>
        <Button variant="outline" size="sm" onClick={() => handleMove("down")}>↓</Button>
        <Button variant="outline" size="sm" onClick={() => handleMove("right")}>→</Button>
      </div>

      {/* Result */}
      {phase !== "playing" && (
        <div className={`rounded-xl border p-5 text-center space-y-3 ${phase === "won" ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"}`}>
          <p className="text-lg font-bold">{phase === "won" ? "🎉 You reached 2048!" : "Game Over"}</p>
          <p className="text-sm text-muted-foreground">Final score: <strong>{score}</strong></p>
          <div className="flex justify-center gap-2">
            <Button onClick={restart} className="bounty-gradient text-white border-0" size="sm">New Game</Button>
            <Link href="/dashboard/games"><Button variant="outline" size="sm">All Games</Button></Link>
          </div>
        </div>
      )}
    </div>
  )
}
