"use client"
import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, Megaphone, Mail, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AdvertiserSettings = {
  submissions_enabled: boolean
  min_budget_kobo: number
  requirements: string
  pricing_info: string
  contact_email: string
  submission_fee_enabled: boolean
  submission_fee_kobo: number
}

const empty = {
  company_name: "", contact_name: "", contact_email: "", contact_phone: "",
  task_title: "", description: "", instructions: "",
  task_type: "verified" as "verified" | "unverified",
  proposed_reward_naira: "", desired_completions: "", budget_naira: "",
  cost_type: "flat" as "flat" | "cpa",
  proof_requirements: "", verification_url: "",
}

export default function AdvertisePage() {
  return (
    <Suspense fallback={
      <>
        <PublicHeader />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground w-6 h-6" />
        </main>
        <Footer />
      </>
    }>
      <AdvertisePageInner />
    </Suspense>
  )
}

function AdvertisePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [settings, setSettings] = useState<AdvertiserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(empty)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<{ submissionId: string; feeAmount: number } | null>(null)
  const [paying, setPaying] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const handledReturn = useRef(false)

  useEffect(() => {
    fetch("/api/advertiser/settings")
      .then((r) => r.json())
      .then(({ data }) => setSettings(data))
      .finally(() => setLoading(false))
  }, [])

  // Paystack redirects back here with `?submission_id=...&reference=...` (or
  // `trxref`) after checkout — this page is public/unauthenticated, so
  // unlike dashboard/verify there's no session to recover the in-progress
  // submission from; the round-trip query params are the only state that
  // survives the redirect. Confirm the payment server-side, then either show
  // the success screen or let the user retry with the fee amount we already
  // have from settings.
  useEffect(() => {
    if (handledReturn.current) return
    const submissionId = searchParams.get("submission_id")
    const ref = searchParams.get("reference") ?? searchParams.get("trxref")
    if (!submissionId || !ref) return
    handledReturn.current = true

    setConfirming(true)
    fetch("/api/advertiser/paystack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_id: submissionId, reference: ref }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          toast.error(json.error)
          if (settings) setPendingPayment({ submissionId, feeAmount: settings.submission_fee_kobo })
          return
        }
        setDone(true)
      })
      .finally(() => {
        setConfirming(false)
        router.replace("/advertise")
      })
  }, [searchParams, settings, router])

  // Watchdog: a redirect can still leave `paying` stuck true if the fetch to
  // our own initialize endpoint hangs (e.g. flaky mobile network) before the
  // browser ever navigates away. Force a defined end state either way.
  useEffect(() => {
    if (!paying) return
    const timeout = setTimeout(() => {
      setPaying(false)
      toast.error("Couldn't reach the payment page. Please try again.")
    }, 20_000)
    return () => clearTimeout(timeout)
  }, [paying])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch("/api/advertiser/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: form.company_name,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone || null,
        task_title: form.task_title,
        description: form.description,
        instructions: form.instructions || null,
        task_type: form.task_type,
        proposed_reward_kobo: Math.round(parseFloat(form.proposed_reward_naira || "0") * 100),
        desired_completions: form.desired_completions ? parseInt(form.desired_completions) : null,
        budget_kobo: Math.round(parseFloat(form.budget_naira || "0") * 100),
        cost_type: form.cost_type,
        proof_requirements: form.proof_requirements || null,
        verification_url: form.verification_url || null,
      }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) { toast.error(json.error); return }

    if (json.data.requires_payment) {
      setPendingPayment({ submissionId: json.data.submission.id, feeAmount: json.data.fee_amount })
    } else {
      setDone(true)
    }
  }

  // Redirects to Paystack's own hosted checkout page instead of opening an
  // in-page iframe via inline.js — see dashboard/verify/page.tsx for the
  // full rationale (ad-blockers and third-party-cookie blocking silently
  // break the inline flow with no recoverable error).
  async function handlePaystackPayment() {
    if (!pendingPayment) return
    setPaying(true)
    const res = await fetch("/api/advertiser/paystack/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_id: pendingPayment.submissionId }),
    })
    const json = await res.json()
    if (json.error || !json.data?.authorization_url) {
      setPaying(false)
      toast.error(json.error ?? "Could not start payment. Try again.")
      return
    }
    window.location.href = json.data.authorization_url
  }

  const minBudgetNaira = settings ? Math.round(settings.min_budget_kobo / 100) : 0
  const feeNaira = settings ? Math.round(settings.submission_fee_kobo / 100) : 0

  return (
    <>
      <PublicHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bounty-gradient mx-auto flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Advertise on BountyTask</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Reach thousands of active Nigerian earners. Submit your task and our team will review it before it goes live.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
        ) : !settings?.submissions_enabled ? (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <p className="font-medium">We're not accepting new advertiser submissions right now.</p>
              {settings?.contact_email && (
                <a href={`mailto:${settings.contact_email}`}
                  className="inline-flex items-center gap-2 text-primary underline underline-offset-2">
                  <Mail className="w-4 h-4" /> {settings.contact_email}
                </a>
              )}
            </CardContent>
          </Card>
        ) : done ? (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
              <p className="font-medium">Submission received!</p>
              <p className="text-sm text-muted-foreground">
                Our team will review it and reach out{form.contact_email ? ` at ${form.contact_email}` : ""} within a few business days.
              </p>
            </CardContent>
          </Card>
        ) : confirming ? (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
              <p className="font-medium">Confirming your payment…</p>
            </CardContent>
          </Card>
        ) : pendingPayment ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">One more step — submission fee</CardTitle>
              <CardDescription>
                A ₦{feeNaira.toLocaleString("en-NG")} fee confirms your submission and moves it into our review queue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="gradient"
                className="w-full"
                onClick={handlePaystackPayment}
                disabled={paying}
              >
                {paying && <Loader2 className="animate-spin" />}
                {paying ? "Redirecting to Paystack…" : <>Pay ₦{feeNaira.toLocaleString("en-NG")} &amp; Submit</>}
              </Button>
              <p className="text-xs text-muted-foreground">
                You&apos;ll be redirected to Paystack&apos;s secure checkout, then brought back here automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {(settings.requirements || settings.pricing_info) && (
              <Card>
                <CardContent className="p-5 space-y-3 text-sm">
                  {settings.requirements && (
                    <div>
                      <p className="font-medium mb-1">Requirements</p>
                      <p className="text-muted-foreground whitespace-pre-line">{settings.requirements}</p>
                    </div>
                  )}
                  {settings.pricing_info && (
                    <div>
                      <p className="font-medium mb-1">Pricing</p>
                      <p className="text-muted-foreground whitespace-pre-line">{settings.pricing_info}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Minimum budget: ₦{minBudgetNaira.toLocaleString("en-NG")}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submit your task</CardTitle>
                <CardDescription>We'll review and get back to you before anything goes live.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input id="company_name" required value={form.company_name}
                        onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact_name">Your Name</Label>
                      <Input id="contact_name" value={form.contact_name}
                        onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact_email">Contact Email</Label>
                      <Input id="contact_email" type="email" required value={form.contact_email}
                        onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact_phone">Phone (optional)</Label>
                      <Input id="contact_phone" value={form.contact_phone}
                        onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="task_title">Task Title</Label>
                    <Input id="task_title" required minLength={5} value={form.task_title}
                      onChange={e => setForm(f => ({ ...f, task_title: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" required rows={3} value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="instructions">Step-by-step Instructions</Label>
                    <Textarea id="instructions" rows={3} value={form.instructions}
                      onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="verification_url">Destination Link (optional)</Label>
                    <Input id="verification_url" type="url" placeholder="https://" value={form.verification_url}
                      onChange={e => setForm(f => ({ ...f, verification_url: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="proof_requirements">Proof Requirements (optional)</Label>
                    <Textarea id="proof_requirements" rows={2} placeholder="What must a worker submit as proof?" value={form.proof_requirements}
                      onChange={e => setForm(f => ({ ...f, proof_requirements: e.target.value }))} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Task Type</Label>
                      <Select value={form.task_type} onValueChange={(v: "verified" | "unverified") => setForm(f => ({ ...f, task_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="verified">Verified (proof reviewed by us)</SelectItem>
                          <SelectItem value="unverified">Instant (no proof required)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Billing Type</Label>
                      <Select value={form.cost_type} onValueChange={(v: "flat" | "cpa") => setForm(f => ({ ...f, cost_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat budget</SelectItem>
                          <SelectItem value="cpa">Pay per completion (CPA)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="proposed_reward">Reward / Completion (₦)</Label>
                      <Input id="proposed_reward" type="number" min={1} step="0.01" required value={form.proposed_reward_naira}
                        onChange={e => setForm(f => ({ ...f, proposed_reward_naira: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="desired_completions">Desired Completions</Label>
                      <Input id="desired_completions" type="number" min={1} placeholder="Uncapped" value={form.desired_completions}
                        onChange={e => setForm(f => ({ ...f, desired_completions: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="budget_naira">Total Budget (₦)</Label>
                      <Input id="budget_naira" type="number" min={minBudgetNaira} step="0.01" required value={form.budget_naira}
                        onChange={e => setForm(f => ({ ...f, budget_naira: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">Min ₦{minBudgetNaira.toLocaleString("en-NG")}</p>
                    </div>
                  </div>

                  <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="animate-spin" />}
                    Submit for Review
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
