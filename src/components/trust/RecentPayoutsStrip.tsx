"use client"

import { useEffect, useState } from "react"
import { Banknote, CheckCircle2, Landmark, ShieldCheck } from "lucide-react"
import { formatCurrency, timeAgo } from "@/lib/utils"

interface RecentPayout {
  id: string
  displayName: string
  bankName: string
  amountKobo: number
  paidAt: string
}

const TRUST_GUARANTEES = [
  {
    icon: ShieldCheck,
    text: "Paystack-verified bank accounts",
  },
  {
    icon: Landmark,
    text: "Direct Nigerian bank transfers",
  },
  {
    icon: Banknote,
    text: "Zero registration fees",
  },
]

export function RecentPayoutsStrip() {
  const [payouts, setPayouts] = useState<RecentPayout[] | null>(null)

  useEffect(() => {
    let active = true

    async function loadPayouts() {
      try {
        const res = await fetch("/api/public/recent-payouts")
        if (!res.ok) {
          if (active) setPayouts([])
          return
        }
        const json = (await res.json()) as { payouts?: RecentPayout[] }
        if (active) {
          setPayouts(Array.isArray(json.payouts) ? json.payouts : [])
        }
      } catch {
        if (active) setPayouts([])
      }
    }

    loadPayouts()
    return () => {
      active = false
    }
  }, [])

  // Loading state: lightweight skeleton strip to avoid layout jump
  if (payouts === null) {
    return (
      <section
        aria-label="Recent verified payouts"
        className="border-b border-border bg-background/60 py-5 px-4"
      >
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 w-56 rounded-full bg-muted/60 animate-pulse"
            />
          ))}
        </div>
      </section>
    )
  }

  // Graceful fallback when fewer than 3 real paid withdrawals exist (or on error)
  if (payouts.length < 3) {
    return (
      <section
        aria-label="Platform payout guarantees"
        className="border-b border-border bg-background/60 py-5 px-4"
      >
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          {TRUST_GUARANTEES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 font-medium">
              <Icon className="w-4 h-4 text-primary shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="Recent verified payouts"
      className="border-b border-border bg-background/60 py-5 px-4"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Recent Verified Payouts
          </span>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1 justify-start lg:justify-center">
          {payouts.map((payout) => (
            <div
              key={payout.id}
              className="shrink-0 flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-sm"
            >
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                    {payout.displayName}
                  </span>
                  <span className="text-xs font-bold text-primary tabular-nums">
                    {formatCurrency(payout.amountKobo)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                  {payout.bankName} · {timeAgo(payout.paidAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
