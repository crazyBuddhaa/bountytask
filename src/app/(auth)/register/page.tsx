"use client"
import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, User, Mail, Lock, Gift, Building2, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type RegistrationSettings = {
  fee_enabled: boolean
  fee_amount: number
  payment_method: "paystack" | "bank_transfer"
  bank_name: string
  bank_number: string
  bank_account_name: string
}

const baseSchema = z.object({
  full_name:     z.string().min(2, "Enter your full name"),
  email:         z.string().email("Enter a valid email"),
  password:      z.string().min(8, "Password must be at least 8 characters"),
  referral_code: z.string().optional(),
})
const bankSchema = baseSchema.extend({
  payment_reference: z.string().min(1, "Enter your transfer reference"),
})
type BaseData = z.infer<typeof baseSchema>
type BankData  = z.infer<typeof bankSchema>

function RegisterForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const defaultRef   = searchParams.get("ref") ?? ""

  const [regSettings, setRegSettings] = useState<RegistrationSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)

  useEffect(() => {
    fetch("/api/settings/registration")
      .then((r) => r.json())
      .then(({ data }) => setRegSettings(data))
      .finally(() => setLoadingSettings(false))
  }, [])

  const isBankTransfer = regSettings?.fee_enabled && regSettings?.payment_method === "bank_transfer"
  const schema = isBankTransfer ? bankSchema : baseSchema

  const { register, handleSubmit, getValues, trigger, formState: { errors, isSubmitting } } =
    useForm<BankData>({
      resolver: zodResolver(schema),
      defaultValues: { referral_code: defaultRef },
    })

  // ── Free registration (no fee) ──────────────────────────────────────────────
  async function onSubmitFree(data: BaseData) {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.full_name, referral_code: data.referral_code || undefined },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (error) { toast.error(error.message); return }
      toast.success("Account created! Check your email to verify.", { duration: 6000 })
      router.push("/sign-in")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    }
  }

  // ── Paystack inline payment ──────────────────────────────────────────────────
  async function handlePaystackPayment() {
    const valid = await trigger()
    if (!valid) return
    const values = getValues()

    const PaystackPop = (window as unknown as { PaystackPop: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } } }).PaystackPop
    if (!PaystackPop) { toast.error("Paystack not loaded. Refresh and try again."); return }

    const ref = `reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    PaystackPop.setup({
      key:      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "",
      email:    values.email,
      amount:   regSettings!.fee_amount,
      currency: "NGN",
      ref,
      metadata: { email: values.email, purpose: "registration_fee" },
      callback: async (resp: { reference: string }) => {
        const res  = await fetch("/api/auth/complete-registration", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ ...values, reference: resp.reference }),
        })
        const json = await res.json()
        if (json.error) { toast.error(json.error); return }
        toast.success("Account created! You can now sign in.", { duration: 6000 })
        router.push("/sign-in")
      },
      onClose: () => {},
    }).openIframe()
  }

  // ── Bank-transfer submission ─────────────────────────────────────────────────
  async function onSubmitBank(data: BankData) {
    try {
      const res  = await fetch("/api/auth/request-verification", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      toast.success(
        "Request submitted! An admin will verify your transfer and activate your account within 24 hours.",
        { duration: 8000 }
      )
      router.push("/sign-in")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    }
  }

  const feeNaira = regSettings ? Math.round(regSettings.fee_amount / 100) : 0

  return (
    <>
      {/* Load Paystack inline script when needed */}
      {regSettings?.fee_enabled && regSettings.payment_method === "paystack" && (
        // eslint-disable-next-line @next/next/no-sync-scripts
        <script src="https://js.paystack.co/v1/inline.js" />
      )}

      <div className="animate-slide-up">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
          <p className="text-muted-foreground mt-1">Start earning ₦ today — it&apos;s free</p>
        </div>

        {/* Fee notice banner */}
        {regSettings?.fee_enabled && (
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-3">
            {regSettings.payment_method === "paystack" ? (
              <CreditCard className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            )}
            <div className="text-sm">
              <p className="font-medium text-foreground">
                ₦{feeNaira.toLocaleString("en-NG")} verification fee required
              </p>
              {regSettings.payment_method === "bank_transfer" ? (
                <p className="text-muted-foreground text-xs mt-0.5">
                  Transfer to{" "}
                  <strong>{regSettings.bank_account_name}</strong> —{" "}
                  {regSettings.bank_number} ({regSettings.bank_name}), then paste your reference below.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs mt-0.5">
                  Pay securely via Paystack. Your account is created instantly after payment.
                </p>
              )}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit(
            regSettings?.fee_enabled && isBankTransfer
              ? (d) => onSubmitBank(d as BankData)
              : (d) => onSubmitFree(d as BaseData)
          )}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="full_name" placeholder="Ada Okonkwo" className="pl-9" {...register("full_name")} />
            </div>
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="you@example.com" className="pl-9" {...register("email")} />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" placeholder="Min. 8 characters" className="pl-9" {...register("password")} />
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="referral_code">
              Referral Code <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="referral_code" placeholder="e.g. ABC12345" className="pl-9 uppercase" {...register("referral_code")} />
            </div>
          </div>

          {/* Bank transfer reference field */}
          {isBankTransfer && (
            <div className="space-y-2">
              <Label htmlFor="payment_reference">Transfer Reference / Narration</Label>
              <Input
                id="payment_reference"
                placeholder="e.g. TRF20260711ABC"
                {...register("payment_reference")}
              />
              {"payment_reference" in errors && errors.payment_reference && (
                <p className="text-xs text-destructive">{errors.payment_reference.message as string}</p>
              )}
            </div>
          )}

          {/* Submit button */}
          {loadingSettings ? (
            <Button disabled className="w-full">
              <Loader2 className="animate-spin" /> Loading…
            </Button>
          ) : regSettings?.fee_enabled && regSettings.payment_method === "paystack" ? (
            <Button
              type="button"
              variant="gradient"
              className="w-full"
              onClick={handlePaystackPayment}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              Pay ₦{feeNaira.toLocaleString("en-NG")} &amp; Create Account
            </Button>
          ) : (
            <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isBankTransfer ? "Submit for Verification" : "Create Account — Get ₦200 Bonus"}
            </Button>
          )}
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By registering you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
          {" & "}
          <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
        </p>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
