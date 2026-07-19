"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Timer, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const GAME_DURATION = 30
const SPAWN_INTERVAL = 900
const TARGET_LIFETIME = 1400

interface TargetObj { id: number; x: number; y: number; size: number }

let nextId = 1

function Stars({ score }: { score: number }) {
  const n = score >= 20 ? 3 : score >= 10 ? 2 : 1
  return (
    <div className="flex justify-center gap-1">
      {[1, 2, 3].map(i => (
        <span key={i} className={`text-2xl ${i <= n ? "" : "opacity-20 grayscale"}`}>⭐</span>
      ))}
    </div>
  )
}

export default function TapTargetPage() {
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle")
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [combo, setCombo] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [targets, setTargets] = useState<TargetObj[]>([])
  const [submitted, setSubmitted] = useState(false)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef  = useRef(0)
  const scoreRef  = useRef(0)
  const missRef   = useRef(0)
  const comboRef  = useRef(0)
  const lastHitRef = useRef(0)

  const cleanup = useCallback(() => {
    if (timerRef.current)  clearInterval(timerRef.current)
    if (spawnRef.current)  clearInterval(spawnRef.current)
  }, [])

  const spawnTarget = useCallback(() => {
    const elapsed    = (Date.now() - startRef.current) / 1000
    const difficulty = Math.min(elapsed / GAME_DURATION, 1)
    const size       = Math.max(34, 68 - difficulty * 30)
    const id         = nextId++
    setTargets(prev => [...prev, { id, x: 5 + Math.random() * 85, y: 5 + Math.random() * 85, size }])
    setTimeout(() => {
      setTargets(prev => {
        const still = prev.some(t => t.id === id)
        if (still) {
          // Expired without being tapped — miss
          missRef.current++
          setMisses(missRef.current)
          comboRef.current = 0
          setCombo(0)
        }
        return prev.filter(t => t.id !== id)
      })
    }, TARGET_LIFETIME)
  }, [])

  const startGame = useCallback(() => {
    scoreRef.current  = 0
    missRef.current   = 0
    comboRef.current  = 0
    lastHitRef.current = 0
    setScore(0); setMisses(0); setCombo(0)
    setTargets([]); setTimeLeft(GAME_DURATION); setSubmitted(false); setPhase("playing")
    startRef.current = Date.now()
    spawnRef.current = setInterval(spawnTarget, SPAWN_INTERVAL)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { cleanup(); setTargets([]); setPhase("done"); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [spawnTarget, cleanup])

  useEffect(() => {
    if (phase === "done" && !submitted) {
      setSubmitted(true)
      const s = scoreRef.current
      fetch("/api/games/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_slug: "tap-target", score: s, completed: true,
          duration_seconds: GAME_DURATION, metadata: { hits: s, misses: missRef.current },
        }),
      }).then(r => r.json()).then(j => { if (!j.error) toast.success(`Score saved: ${s} hits!`) })
    }
  }, [phase, submitted])

  useEffect(() => () => cleanup(), [cleanup])

  function hitTarget(id: number) {
    setTargets(prev => prev.filter(t => t.id !== id))
    const now = Date.now()
    const gap = now - lastHitRef.current
    lastHitRef.current = now
    comboRef.current = gap < 1500 ? comboRef.current + 1 : 1
    setCombo(comboRef.current)
    scoreRef.current++
    setScore(scoreRef.current)
  }

  const progress = ((GAME_DURATION - timeLeft) / GAME_DURATION) * 100
  const accuracy = scoreRef.current + missRef.current > 0
    ? Math.round(scoreRef.current / (scoreRef.current + missRef.current) * 100)
    : 0

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold flex-1">🎯 Tap the Target</h1>
        {phase === "playing" && (
          <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
            <Timer className="w-4 h-4 text-primary" />
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Idle */}
      {phase === "idle" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center text-4xl">🎯</div>
          <div>
            <h2 className="text-xl font-bold">Tap the Target</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xs mx-auto">
              Tap circles before they vanish. Targets shrink as time runs out — stay sharp!
            </p>
          </div>
          <div className="flex justify-center gap-8 text-center">
            <div>
              <p className="text-2xl font-black text-primary">30s</p>
              <p className="text-xs text-muted-foreground mt-0.5">Round time</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-2xl font-black text-red-500">Shrinks</p>
              <p className="text-xs text-muted-foreground mt-0.5">Over time</p>
            </div>
          </div>
          <Button onClick={startGame} className="bounty-gradient text-white border-0 px-10">
            Start Game
          </Button>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && (
        <div className="space-y-2">
          {/* Stats bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-3 shrink-0 text-sm">
              <span className="font-bold text-primary tabular-nums">{score} hits</span>
              {misses > 0 && <span className="text-xs text-muted-foreground tabular-nums">{misses} miss</span>}
              {combo >= 3 && (
                <span className="text-xs font-bold text-amber-500 animate-pulse">🔥 ×{combo}</span>
              )}
            </div>
          </div>

          {/* Arena */}
          <div
            className="relative rounded-xl border bg-muted/20 overflow-hidden select-none touch-none"
            style={{
              height: "420px",
              backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          >
            {targets.map(t => (
              <button
                key={t.id}
                onClick={() => hitTarget(t.id)}
                className="absolute rounded-full bounty-gradient shadow-lg shadow-primary/20 border-2 border-white/40 cursor-pointer active:scale-90"
                style={{
                  width: t.size, height: t.size,
                  left: `${t.x}%`, top: `${t.y}%`,
                  transform: "translate(-50%, -50%)",
                  animation: "tile-pop 0.22s ease-out both",
                }}
              />
            ))}
            {targets.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Target className="w-4 h-4 opacity-40" />
                Incoming…
              </div>
            )}
          </div>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-4 animate-bounce-in">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center text-4xl">🎯</div>
          <div>
            <p className="text-5xl font-black tabular-nums">{score}</p>
            <p className="text-muted-foreground font-semibold mt-1">hits</p>
          </div>
          <Stars score={score} />
          <div className="flex justify-center gap-8 text-sm">
            <div className="text-center">
              <p className="text-xl font-bold tabular-nums">{misses}</p>
              <p className="text-xs text-muted-foreground">missed</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold tabular-nums">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">accuracy</p>
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {score >= 20 ? "🔥 Lightning reflexes!" : score >= 10 ? "👏 Solid performance!" : "Keep tapping to improve!"}
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={startGame} className="bounty-gradient text-white border-0">Play Again</Button>
            <Link href="/dashboard/games"><Button variant="outline">All Games</Button></Link>
          </div>
        </div>
      )}
    </div>
  )
}
