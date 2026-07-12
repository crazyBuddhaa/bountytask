"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CreditCard, Building2, Loader2, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

type VerificationSettings = {
  fee_enabled: boolean
  fee_amount: number
  payment_method: "paystack" | "bank_transfer"
  bank_name: string
  bank_number: string
  bank_account_name: string
}

export default function VerifyPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<VerificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [reference, setReference] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch("/api/settings/verification")
      .then((r) => r.json())
      .then(({ data }) => setSettings(data))
      .finally(() => setLoading(false))
  }, [])

  async function handlePaystackPayment() {
    if (!settings) return
    const PaystackPop = (window as unknown as {
      PaystackPop?: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } }
    }).PaystackPop
    if (!PaystackPop) { toast.error("Paystack not loaded. Refresh and try again."); return }

    const profileRes = await fetch("/api/profile")
    const profileJson = await profileRes.json()
    const email = profileJson.data?.email
    if (!email) { toast.error("Could not load your profile. Refresh and try again."); return }

    setPaying(true)
    const ref = `verify_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "",
      email,
      amount: settings.fee_amount,
      currency: "NGN",
      ref,
      metadata: { purpose: "withdrawal_verification_fee" },
      callback: async (resp: { reference: string }) => {
        const res = await fetch("/api/verification/paystack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: resp.reference }),
        })
        const json = await res.json()
        setPaying(false)
        if (json.error) { toast.error(json.error); return }
        toast.success("You're verified! You can now withdraw.")
        router.push("/dashboard/withdrawal")
      },
      onClose: () => setPaying(false),
    }).openIframe()
  }

  async function handleBankTransferSubmit() {
    if (!reference.trim()) { toast.error("Enter your transfer reference"); return }
    setSubmitting(true)
    const res = await fetch("/api/verification/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_reference: reference.trim() }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (json.error) { toast.error(json.error); return }
    setSubmitted(true)
    toast.success("Submitted! An admin will verify your transfer within 24 hours.")
  }

  if (loading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Fee got disabled while the user was on this page (or navigated here directly)
  if (!settings?.fee_enabled) {
    return (
      <div className="max-w-lg">
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
            <p className="font-medium">No verification needed right now</p>
            <p className="text-sm text-muted-foreground mt-1">You can withdraw freely.</p>
            <Button className="mt-4" onClick={() => router.push("/dashboard/withdrawal")}>
              Go to Withdrawals
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const feeNaira = Math.round(settings.fee_amount / 100)

  return (
    <div className="max-w-lg space-y-6">
      {settings.payment_method === "paystack" && (
        // eslint-disable-next-line @next/next/no-sync-scripts
        <script src="https://js.paystack.co/v1/inline.js" />
      )}

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> Verify to Withdraw
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A one-time ₦{feeNaira.toLocaleString("en-NG")} fee confirms you're a real person before your
          first withdrawal. This only happens once.
        </p>
      </div>

      {settings.payment_method === "paystack" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Pay with Paystack
            </CardTitle>
            <CardDescription>Instant — you can withdraw immediately after payment.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="gradient" className="w-full" onClick={handlePaystackPayment} disabled={paying}>
              {paying && <Loader2 className="animate-spin" />}
              Pay ₦{feeNaira.toLocaleString("en-NG")} &amp; Verify
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Bank Transfer
            </CardTitle>
            <CardDescription>An admin reviews your transfer, usually within 24 hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitted ? (
              <div className="text-center py-6">
                <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-amber-500" />
                <p className="font-medium">Request submitted</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We'll email you once your transfer is verified.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                  <p>
                    Transfer <strong>₦{feeNaira.toLocaleString("en-NG")}</strong> to:
                  </p>
                  <p className="font-medium">{settings.bank_account_name}</p>
                  <p>{settings.bank_number} · {settings.bank_name}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Transfer Reference / Narration</Label>
                  <Input
                    id="reference"
                    placeholder="e.g. TRF20260712ABC"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <Button variant="gradient" className="w-full" onClick={handleBankTransferSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />}
                  Submit for Verification
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
