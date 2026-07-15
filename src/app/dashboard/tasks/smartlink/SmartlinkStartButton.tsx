"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ExternalLink, Loader2, Clock } from "lucide-react"

interface Props {
  rewardKobo: number
  /** ISO string of when the cooldown ends, or null if not on cooldown. */
  cooldownUntil: string | null
  capHit: boolean
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00"
  const totalSecs = Math.ceil(ms / 1000)
  const mins      = Math.floor(totalSecs / 60)
  const secs      = totalSecs % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function SmartlinkStartButton({ rewardKobo, cooldownUntil, capHit }: Props) {
  const rewardNaira = (rewardKobo / 100).toFixed(2)

  const getCooldownMs = useCallback(() => {
    if (!cooldownUntil) return 0
    return Math.max(0, new Date(cooldownUntil).getTime() - Date.now())
  }, [cooldownUntil])

  const [cooldownMs, setCooldownMs]   = useState<number>(getCooldownMs)
  const [loading,    setLoading]      = useState(false)
  const [localCooldownUntil, setLocalCooldownUntil] = useState<string | null>(cooldownUntil)

  // Countdown tick
  useEffect(() => {
    const target = localCooldownUntil ? new Date(localCooldownUntil).getTime() : 0
    if (!target || Date.now() >= target) {
      setCooldownMs(0)
      return
    }
    setCooldownMs(Math.max(0, target - Date.now()))
    const id = setInterval(() => {
      const remaining = Math.max(0, target - Date.now())
      setCooldownMs(remaining)
      if (remaining === 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [localCooldownUntil])

  const onCooldown = cooldownMs > 0
  const disabled   = loading || onCooldown || capHit

  async function handleClick() {
    setLoading(true)
    try {
      const res  = await fetch("/api/asterra/click", { method: "POST" })
      const data = await res.json()

      if (res.status === 429 && data.error === "cooldown" && data.nextAvailableAt) {
        setLocalCooldownUntil(data.nextAvailableAt)
        return
      }
      if (!res.ok) {
        console.error("Smartlink click error:", data.error)
        return
      }

      // Credit applied — open the link without losing the user's session
      window.open(data.url, "_blank", "noopener,noreferrer")
      // Cooldown starts now
      const next = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      setLocalCooldownUntil(next)
    } finally {
      setLoading(false)
    }
  }

  if (capHit) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        You&apos;ve hit today&apos;s daily limit. Come back tomorrow.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        size="lg"
        onClick={handleClick}
        disabled={disabled}
        className="gap-2 min-w-48"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ExternalLink className="w-4 h-4" />
        )}
        {loading ? "Opening…" : `Earn ₦${rewardNaira}`}
      </Button>
      {onCooldown && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Next available in {formatCountdown(cooldownMs)}
        </p>
      )}
    </div>
  )
}
