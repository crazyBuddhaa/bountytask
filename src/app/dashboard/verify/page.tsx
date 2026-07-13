"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CreditCard, Building2, Loader2, ShieldCheck, Smartphone, Clock, AlertCircle, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

type VerificationSettings = {
  fee_enabled: boolean
  fee_amount: number
  payment_method: "paystack" | "bank_transfer"
  bank_name: string
  bank_number: string
  bank_account_name: string
  phone_verification_enabled: boolean
}

type PendingRequest = {
  id: string
  status: string
  payment_reference: string
  created_at: string
}

export default function VerifyPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<VerificationSettings | null>(null)
  const [kycVerified, setKycVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reference, setReference] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Phone verification
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [phoneStep, setPhoneStep] = useState<"input" | "sent">("input")
  const [sendingCode, setSendingCode] = useState(false)
  const [confirmingCode, setConfirmingCode] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/verification").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/verification/request").then((r) => r.json()),
    ])
      .then(([ver, prof, pending]) => {
        setSettings(ver.data)
        setKycVerified(!!prof.data?.kyc_verified)
        setPhoneVerified(!!prof.data?.phone_verified)
        setPendingRequest(pending.data ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCancelRequest() {
    setCancelling(true)
    const res = await fetch("/api/verification/request", { method: "DELETE" })
    const json = await res.json()
    setCancelling(false)
    if (json.error) { toast.error(json.error); return }
    setPendingRequest(null)
    setReference("")
    toast.success("Verification request cancelled. You can submit a new one.")
  }

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
        setKycVerified(true)
        toast.success("You're verified!")
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
    setPendingRequest({ id: "", status: "pending", payment_reference: reference.trim(), created_at: new Date().toISOString() })
    toast.success("Submitted! An admin will verify your transfer within 24 hours.")
  }

  async function handleSendCode() {
    if (!phone.trim()) { toast.error("Enter your phone number"); return }
    setSendingCode(true)
    const res = await fetch("/api/verification/phone/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() }),
    })
    const json = await res.json()
    setSendingCode(false)
    if (json.error) { toast.error(json.error); return }
    setPhoneStep("sent")
    toast.success("Code sent! Check your phone.")
  }

  async function handleConfirmCode() {
    if (!/^\d{6}$/.test(code.trim())) { toast.error("Enter the 6-digit code"); return }
    setConfirmingCode(true)
    const res = await fetch("/api/verification/phone/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    })
    const json = await res.json()
    setConfirmingCode(false)
    if (json.error) { toast.error(json.error); return }
    setPhoneVerified(true)
    toast.success("Phone verified!")
  }

  if (loading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const needsFee = !!settings?.fee_enabled && !kycVerified
  const needsPhone = !!settings?.phone_verification_enabled && !phoneVerified

  // Nothing (or nothing left) to verify
  if (!needsFee && !needsPhone) {
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

  const feeNaira = Math.round((settings?.fee_amount ?? 0) / 100)

  return (
    <div className="max-w-lg space-y-6">
      {needsFee && settings?.payment_method === "paystack" && (
        // eslint-disable-next-line @next/next/no-sync-scripts
        <script src="https://js.paystack.co/v1/inline.js" />
      )}

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> Verify to Withdraw
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Complete the steps below before your first withdrawal. This only happens once.
        </p>
      </div>

      {needsFee && (
        settings!.payment_method === "paystack" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Pay with Paystack
              </CardTitle>
              <CardDescription>
                A one-time ₦{feeNaira.toLocaleString("en-NG")} fee confirms you're a real person.
                Instant — you can withdraw immediately after payment.
              </CardDescription>
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
              <CardDescription>
                A one-time ₦{feeNaira.toLocaleString("en-NG")} fee confirms you're a real person.
                An admin reviews your transfer, usually within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingRequest ? (
                <>
                  {/* Pending state */}
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-amber-900">Pending Verification</p>
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200 border">Under Review</Badge>
                      </div>
                      <p className="text-xs text-amber-700">
                        Your request was submitted and is awaiting admin review — usually within 24 hours.
                      </p>
                      <p className="text-xs text-amber-700 font-mono mt-1">
                        Reference: <span className="font-semibold">{pendingRequest.payment_reference}</span>
                      </p>
                    </div>
                  </div>

                  {/* Duplicate reference warning */}
                  <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Note:</span> If you cancel and resubmit, you must use a{" "}
                      <span className="font-semibold">different transaction reference</span>. The same reference
                      cannot be used twice.
                    </p>
                  </div>

                  {/* Cancel button */}
                  <Button
                    variant="outline"
                    className="w-full border-destructive/40 text-destructive hover:bg-destructive/5"
                    onClick={handleCancelRequest}
                    disabled={cancelling}
                  >
                    {cancelling ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <X className="w-4 h-4 mr-2" />}
                    Cancel &amp; Submit a New Request
                  </Button>
                </>
              ) : (
                <>
                  <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                    <p>
                      Transfer <strong>₦{feeNaira.toLocaleString("en-NG")}</strong> to:
                    </p>
                    <p className="font-medium">{settings!.bank_account_name}</p>
                    <p>{settings!.bank_number} · {settings!.bank_name}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reference">Transfer Reference / Narration</Label>
                    <Input
                      id="reference"
                      placeholder="e.g. TRF20260712ABC"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      Use the exact reference shown in your bank app. The same reference cannot be used twice.
                    </p>
                  </div>
                  <Button variant="gradient" className="w-full" onClick={handleBankTransferSubmit} disabled={submitting}>
                    {submitting && <Loader2 className="animate-spin" />}
                    Submit for Verification
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )
      )}

      {needsPhone && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Verify Your Phone
            </CardTitle>
            <CardDescription>
              We'll text you a 6-digit code to confirm your number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {phoneStep === "input" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="+2348012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Include your country code, e.g. +234...</p>
                </div>
                <Button variant="gradient" className="w-full" onClick={handleSendCode} disabled={sendingCode}>
                  {sendingCode && <Loader2 className="animate-spin" />}
                  Send Code
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent to {phone}. Didn't get it?{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => { setPhoneStep("input"); setCode("") }}
                    >
                      Try a different number
                    </button>
                  </p>
                </div>
                <Button variant="gradient" className="w-full" onClick={handleConfirmCode} disabled={confirmingCode}>
                  {confirmingCode && <Loader2 className="animate-spin" />}
                  Confirm Code
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!needsFee && !needsPhone && (
        <Button className="w-full" onClick={() => router.push("/dashboard/withdrawal")}>
          Go to Withdrawals
        </Button>
      )}
    </div>
  )
}
