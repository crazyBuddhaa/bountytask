"use client"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, Layers } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import type { Tier } from "@/types"

export default function AdminTiersPage() {
  const [tiers, setTiers]     = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/admin/tiers")
      .then((r) => r.json())
      .then(({ data }) => setTiers(data ?? []))
      .finally(() => setLoading(false))
  }, [])

  function update(id: number, patch: Partial<Tier>) {
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  async function save(tier: Tier) {
    setSavingId(tier.id)
    const res = await fetch(`/api/admin/tiers/${tier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tier.name,
        min_referrals: tier.min_referrals,
        min_completions: tier.min_completions,
        daily_task_limit: tier.daily_task_limit,
        perks: tier.perks,
      }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setSavingId(null); return }
    toast.success(`${tier.name} saved`)
    setSavingId(null)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="w-6 h-6" /> User Tiers
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Users level up automatically when they reach a tier's referral threshold <em>or</em> its
          task-completion threshold — whichever comes first. Adjust thresholds, daily limits, and
          perks for each tier below.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
        </div>
      ) : (
        tiers.map((tier) => (
          <Card key={tier.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bounty-gradient text-white text-xs font-bold flex items-center justify-center">
                  {tier.id}
                </span>
                Tier {tier.id}
              </CardTitle>
              <CardDescription>
                {tier.id === 1
                  ? "The default tier every new user starts on."
                  : "Unlocked once a user meets either the referral or the task-completion threshold below."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={`name-${tier.id}`}>Tier Name</Label>
                <Input id={`name-${tier.id}`} value={tier.name}
                  onChange={(e) => update(tier.id, { name: e.target.value })} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`min-ref-${tier.id}`}>Min. Referrals to Unlock</Label>
                  <Input id={`min-ref-${tier.id}`} type="number" min={0}
                    value={tier.min_referrals}
                    disabled={tier.id === 1}
                    onChange={(e) => update(tier.id, { min_referrals: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground">Referral-based path to this tier.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`min-comp-${tier.id}`}>Min. Tasks Completed to Unlock</Label>
                  <Input id={`min-comp-${tier.id}`} type="number" min={0}
                    value={tier.min_completions}
                    disabled={tier.id === 1}
                    onChange={(e) => update(tier.id, { min_completions: parseInt(e.target.value) || 0 })} />
                  <p className="text-xs text-muted-foreground">Task-completion path to this tier.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`limit-${tier.id}`}>Daily Task Limit</Label>
                <Input id={`limit-${tier.id}`} type="number" min={1} className="w-40"
                  value={tier.daily_task_limit}
                  onChange={(e) => update(tier.id, { daily_task_limit: parseInt(e.target.value) || 1 })} />
                <p className="text-xs text-muted-foreground">Max tasks a user on this tier can complete per day.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`perks-${tier.id}`}>Perks Description</Label>
                <Textarea id={`perks-${tier.id}`} rows={2} value={tier.perks}
                  onChange={(e) => update(tier.id, { perks: e.target.value })}
                  placeholder="e.g. Access to exclusive tasks, priority support..." />
                <p className="text-xs text-muted-foreground">Shown to users on their progress page.</p>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => save(tier)} disabled={savingId === tier.id}>
                  {savingId === tier.id ? <Loader2 className="animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Tier {tier.id}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
