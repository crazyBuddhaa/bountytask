"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const GAME_DURATION = 30 // seconds
const SPAWN_INTERVAL = 900 // ms between spawns
const TARGET_LIFETIME = 1400 // ms before target disappears

interface Target {
  id: number
  x: number  // percent
  y: number  // percent
  size: number // px
  born: number
}

let nextId = 1

export default function TapTargetPage() {
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle")
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [targets, setTargets] = useState<Target[]>([])
  const [submitted, setSubmitted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const finalScore = useRef(0)

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (spawnRef.current) clearInterval(spawnRef.current)
  }, [])

  const spawnTarget = useCallback(() => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000
    const difficulty = Math.min(elapsed / GAME_DURATION, 1)
    const size = Math.max(36, 68 - difficulty * 28) // shrinks from 68px to 36px

    const target: Target = {
      id: nextId++,
      x: 5 + Math.random() * 85,
      y: 5 + Math.random() * 85,
      size,
      born: Date.now(),
    }
    setTargets(prev => [...prev, target])
    setTimeout(() => {
      setTargets(prev => prev.filter(t => t.id !== target.id))
    }, TARGET_LIFETIME)
  }, [])

  const startGame = useCallback(() => {
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setTargets([])
    setPhase("playing")
    setSubmitted(false)
    finalScore.current = 0
    startTimeRef.current = Date.now()

    spawnRef.current = setInterval(spawnTarget, SPAWN_INTERVAL)

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          cleanup()
          setTargets([])
          setPhase("done")
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [spawnTarget, cleanup])

  // Save session when done
  useEffect(() => {
    if (phase === "done" && !submitted) {
      setSubmitted(true)
      const s = finalScore.current
      fetch("/api/games/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_slug: "tap-target",
          score: s,
          completed: true,
          duration_seconds: GAME_DURATION,
          metadata: { hits: s },
        }),
      }).then(r => r.json()).then(j => {
        if (!j.error) toast.success(`Score saved: ${s} hits!`)
      })
    }
  }, [phase, submitted])

  useEffect(() => () => cleanup(), [cleanup])

  function hitTarget(id: number) {
    setTargets(prev => prev.filter(t => t.id !== id))
    setScore(prev => {
      const next = prev + 1
      finalScore.current = next
      return next
    })
  }

  const progress = ((GAME_DURATION - timeLeft) / GAME_DURATION) * 100

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex-1">🎯 Tap the Target</h1>
        {phase === "playing" && (
          <div className="flex items-center gap-2 text-sm font-bold">
            <Timer className="w-4 h-4 text-primary" />
            {timeLeft}s
          </div>
        )}
      </div>

      {phase === "idle" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-5xl">🎯</p>
          <h2 className="text-xl font-bold">Tap the Target</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Targets appear randomly on screen. Tap them before they disappear!<br />
            Targets shrink over time. You have <strong>30 seconds</strong>.
          </p>
          <Button onClick={startGame} className="bounty-gradient text-white border-0 px-8">
            Start Game
          </Button>
        </div>
      )}

      {phase === "playing" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-primary">Score: {score}</span>
            <span className="text-muted-foreground">Tap the circles!</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div
            className="relative rounded-xl border bg-muted/20 overflow-hidden select-none touch-none"
            style={{ height: "420px" }}
          >
            {targets.map(t => (
              <button
                key={t.id}
                onClick={() => hitTarget(t.id)}
                className="absolute rounded-full bounty-gradient shadow-lg transition-transform active:scale-90 hover:scale-110 cursor-pointer border-2 border-white/30"
                style={{
                  width: t.size,
                  height: t.size,
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  transform: "translate(-50%, -50%)",
                  animation: "ping-once 0.2s ease-out",
                }}
              />
            ))}
            {targets.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                Targets incoming…
              </div>
            )}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-4">
          <p className="text-5xl">🎯</p>
          <h2 className="text-2xl font-black">{score} hits!</h2>
          <p className="text-muted-foreground text-sm">
            {score >= 20 ? "Amazing reflexes! 🔥" : score >= 10 ? "Good job! Keep practicing." : "Nice try! Play again to beat your score."}
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={startGame} className="bounty-gradient text-white border-0">
              Play Again
            </Button>
            <Link href="/dashboard/games">
              <Button variant="outline">All Games</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
