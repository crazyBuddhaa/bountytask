"use client"
import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, User, Mail, Lock, Gift, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  full_name:     z.string().min(2, "Enter your full name"),
  email:         z.string().email("Enter a valid email"),
  password:      z.string().min(8, "Password must be at least 8 characters"),
  referral_code: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function RegisterForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const defaultRef   = searchParams.get("ref")?.toUpperCase() ?? ""

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { referral_code: defaultRef },
    })

  // Referral code live validation
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "valid" | "invalid">(
    defaultRef ? "checking" : "idle"
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refCode = watch("referral_code")

  useEffect(() => {
    const code = refCode?.trim().toUpperCase() ?? ""
    if (!code) { setCodeStatus("idle"); return }

    setCodeStatus("checking")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/referrals/validate?code=${encodeURIComponent(code)}`)
        const json = await res.json()
        setCodeStatus(json.valid ? "valid" : "invalid")
      } catch {
        setCodeStatus("idle")
      }
    }, 500)
  }, [refCode])

  async function onSubmit(data: FormData) {
    // Block submission if the code typed is invalid
    if (codeStatus === "invalid") {
      toast.error("That referral code doesn't exist. Clear it or enter a valid one.")
      return
    }
    try {
      const supabase = createClient()
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.full_name, referral_code: data.referral_code?.trim().toUpperCase() || undefined },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (error) { toast.error(error.message); return }

      if (signUpData.user) {
        try {
          await fetch("/api/auth/credit-signup-bonus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: signUpData.user.id,
              referral_code: data.referral_code?.trim().toUpperCase() || undefined,
            }),
          })
        } catch {
          // Non-fatal — /api/auth/callback handles it as idempotent fallback
        }
      }

      toast.success("Account created! Check your email to verify.", { duration: 6000 })
      router.push("/sign-in")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    }
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
        <p className="text-muted-foreground mt-1">Start earning ₦ today — it&apos;s free</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <Input
              id="referral_code"
              placeholder="e.g. ABC12345"
              className={`pl-9 pr-9 uppercase tracking-widest ${
                codeStatus === "valid" ? "border-emerald-500 focus-visible:ring-emerald-500" :
                codeStatus === "invalid" ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
              {...register("referral_code")}
            />
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {codeStatus === "checking" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {codeStatus === "valid"    && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {codeStatus === "invalid"  && <XCircle className="w-4 h-4 text-destructive" />}
            </div>
          </div>
          {codeStatus === "valid"   && <p className="text-xs text-emerald-600">✓ Valid referral code — you&apos;ll both get a bonus!</p>}
          {codeStatus === "invalid" && <p className="text-xs text-destructive">This referral code doesn&apos;t exist. Clear it to continue without one.</p>}
        </div>

        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting || codeStatus === "checking"}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Create Account — Get ₦200 Bonus
        </Button>
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
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
