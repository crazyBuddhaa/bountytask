"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Timer, Target, Crosshair } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const GAME_DURATION  = 30
const SPAWN_INTERVAL = 900
const TARGET_LIFETIME = 1400

interface TargetObj { id: number; x: number; y: number; size: number }

let nextId = 1

function Stars({ score }: { score: number }) {
  const n = score >= 20 ? 3 : score >= 10 ? 2 : 1
  return (
    <div className="flex justify-center gap-1.5">
      {[1, 2, 3].map(i => (
        <span key={i} className={`text-2xl ${i <= n ? "" : "opacity-20 grayscale"}`}>⭐</span>
      ))}
    </div>
  )
}

export default function TapTargetPage() {
  const [phase, setPhase]     = useState<"idle" | "playing" | "done">("idle")
  const [score, setScore]     = useState(0)
  const [misses, setMisses]   = useState(0)
  const [combo, setCombo]     = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [targets, setTargets] = useState<TargetObj[]>([])
  const [submitted, setSubmitted] = useState(false)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef   = useRef(0)
  const scoreRef   = useRef(0)
  const missRef    = useRef(0)
  const comboRef   = useRef(0)
  const lastHitRef = useRef(0)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (spawnRef.current) clearInterval(spawnRef.current)
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
    scoreRef.current = 0; missRef.current = 0; comboRef.current = 0; lastHitRef.current = 0
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

  const progress  = ((GAME_DURATION - timeLeft) / GAME_DURATION) * 100
  const accuracy  = scoreRef.current + missRef.current > 0
    ? Math.round(scoreRef.current / (scoreRef.current + missRef.current) * 100)
    : 0
  const urgency   = timeLeft <= 10

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/games" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-black text-xl text-red-500">Tap the Target</h1>
        </div>
        {phase === "playing" && (
          <div className={`flex items-center gap-1.5 text-sm font-black tabular-nums px-3 py-1.5 rounded-xl border ${
            urgency
              ? "text-red-400 bg-red-500/10 border-red-500/40 animate-pulse"
              : "text-foreground bg-muted border-border"
          }`}>
            <Timer className="w-4 h-4" />
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Idle */}
      {phase === "idle" && (
        <div className="rounded-2xl overflow-hidden border border-red-500/30 bg-card">
          {/* Hero image */}
          <div className="relative h-48">
            <Image src="/games/tap-target.jpg" alt="Tap the Target" fill className="object-cover" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-5 right-5">
              <h2 className="text-2xl font-black text-white">Tap the Target</h2>
              <p className="text-white/70 text-sm mt-0.5">How fast are your reflexes?</p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <p className="text-muted-foreground text-sm text-center max-w-xs mx-auto">
              Tap circles before they vanish. Targets shrink as time runs out — stay sharp!
            </p>
            <div className="flex justify-center gap-8 text-center">
              <div>
                <p className="text-3xl font-black text-red-500">30s</p>
                <p className="text-xs text-muted-foreground mt-0.5">Round time</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="text-3xl font-black text-orange-500">Shrinks</p>
                <p className="text-xs text-muted-foreground mt-0.5">Over time</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="text-3xl font-black text-amber-500">∞</p>
                <p className="text-xs text-muted-foreground mt-0.5">Replays</p>
              </div>
            </div>
            <Button onClick={startGame} className="w-full bg-red-500 hover:bg-red-600 text-white border-0 font-black text-base py-6 shadow-lg shadow-red-500/30">
              Start Game
            </Button>
          </div>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && (
        <div className="space-y-2">
          {/* Stats bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-1000 ${urgency ? "bg-red-500" : "bg-red-500"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center gap-3 shrink-0 text-sm">
              <span className="font-black text-red-500 tabular-nums">{score} <span className="font-normal text-xs text-muted-foreground">hits</span></span>
              {misses > 0 && <span className="text-xs text-muted-foreground tabular-nums">{misses} miss</span>}
              {combo >= 3 && (
                <span className="text-xs font-black text-amber-500 animate-pulse">🔥 ×{combo}</span>
              )}
            </div>
          </div>

          {/* Arena */}
          <div
            className="relative rounded-2xl border border-red-500/20 overflow-hidden select-none touch-none bg-gradient-to-br from-red-950/30 to-background"
            style={{ height: "420px" }}
          >
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }} />

            {targets.map(t => (
              <button
                key={t.id}
                onClick={() => hitTarget(t.id)}
                className="absolute rounded-full bg-red-500 shadow-lg shadow-red-500/40 border-2 border-white/30 cursor-pointer active:scale-75 transition-transform"
                style={{
                  width: t.size, height: t.size,
                  left: `${t.x}%`, top: `${t.y}%`,
                  transform: "translate(-50%, -50%)",
                  animation: "tile-pop 0.18s ease-out both",
                }}
              >
                <div className="absolute inset-[20%] rounded-full bg-red-300/40" />
                <div className="absolute inset-[40%] rounded-full bg-white/50" />
              </button>
            ))}
            {targets.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground/50 text-sm">
                <Crosshair className="w-5 h-5 opacity-40" />
                Incoming…
              </div>
            )}
          </div>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="rounded-2xl border border-red-500/30 bg-card overflow-hidden animate-bounce-in">
          <div className="relative h-32 overflow-hidden">
            <Image src="/games/tap-target.jpg" alt="" fill className="object-cover opacity-50" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
          </div>
          <div className="px-6 pb-6 -mt-8 relative text-center space-y-4">
            <p className="text-6xl font-black tabular-nums text-red-500 drop-shadow-lg">{score}</p>
            <p className="text-muted-foreground font-bold -mt-2">hits</p>
            <Stars score={score} />
            <div className="flex justify-center gap-8 text-sm">
              <div className="text-center">
                <p className="text-2xl font-black tabular-nums">{misses}</p>
                <p className="text-xs text-muted-foreground">missed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black tabular-nums">{accuracy}%</p>
                <p className="text-xs text-muted-foreground">accuracy</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              {score >= 20 ? "🔥 Lightning reflexes!" : score >= 10 ? "👏 Solid performance!" : "Keep tapping to improve!"}
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={startGame} className="bg-red-500 hover:bg-red-600 text-white border-0 font-bold shadow-md shadow-red-500/30">Play Again</Button>
              <Link href="/dashboard/games"><Button variant="outline">All Games</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
