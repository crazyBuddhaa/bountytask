"use client"

import { useState, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"

export interface SubmitSessionPayload {
  score: number
  completed: boolean
  duration_seconds?: number
  metadata?: Record<string, unknown>
}

export interface SubmitSessionResult {
  ok: boolean
  data: unknown
  error: string | null
}

/**
 * Manages single-use game entry tokens (`entry_id`) and session submission
 * for both free and paid game modes.
 *
 * Components calling this hook MUST be wrapped in a `<Suspense>` boundary
 * because it uses `useSearchParams()`.
 */
export function useGameEntry(gameSlug: string) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialEntryId = searchParams.get("entry_id")
  const [entryId, setEntryId] = useState<string | null>(initialEntryId)
  const entryIdRef = useRef<string | null>(initialEntryId)
  const [entering, setEntering] = useState(false)

  const acquireEntry = useCallback(async (): Promise<boolean> => {
    setEntering(true)
    try {
      const res = await fetch("/api/games/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_slug: gameSlug }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const fallback =
          res.status === 402
            ? "Insufficient balance to play this game."
            : res.status === 409
            ? "You have already played this game today."
            : "Could not start game."
        toast.error(typeof json.error === "string" ? json.error : fallback)
        return false
      }

      const token: string | null =
        json.data?.entry_id ?? json.data?.entry_token ?? null
      entryIdRef.current = token
      setEntryId(token)
      router.refresh()
      return true
    } catch {
      toast.error("Network error. Please try again.")
      return false
    } finally {
      setEntering(false)
    }
  }, [gameSlug, router])

  const ensureEntry = useCallback(async (): Promise<boolean> => {
    if (entryIdRef.current) return true
    return acquireEntry()
  }, [acquireEntry])

  const submitSession = useCallback(
    async (payload: SubmitSessionPayload): Promise<SubmitSessionResult> => {
      const currentEntryId = entryIdRef.current
      try {
        const res = await fetch("/api/games/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_slug: gameSlug,
            score: payload.score,
            completed: payload.completed,
            ...(payload.duration_seconds !== undefined
              ? { duration_seconds: payload.duration_seconds }
              : {}),
            ...(payload.metadata !== undefined
              ? { metadata: payload.metadata }
              : {}),
            entry_id: currentEntryId ?? undefined,
          }),
        })
        const json = await res.json().catch(() => ({}))

        if (payload.completed) {
          entryIdRef.current = null
          setEntryId(null)
        }

        if (!res.ok) {
          const errMsg =
            typeof json.error === "string"
              ? json.error
              : "Failed to save game session."
          toast.error(errMsg)
          return { ok: false, data: null, error: errMsg }
        }

        return { ok: true, data: json.data ?? null, error: null }
      } catch {
        const errMsg = "Network error while saving score."
        toast.error(errMsg)
        return { ok: false, data: null, error: errMsg }
      }
    },
    [gameSlug]
  )

  return {
    entryId,
    entering,
    acquireEntry,
    ensureEntry,
    submitSession,
  }
}
