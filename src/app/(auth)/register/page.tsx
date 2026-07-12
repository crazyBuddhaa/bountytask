"use client"
import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, User, Mail, Lock, Gift } from "lucide-react"
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
  const defaultRef   = searchParams.get("ref") ?? ""

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { referral_code: defaultRef },
    })

  async function onSubmit(data: FormData) {
    try {
      const supabase = createClient()
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { full_name: data.full_name, referral_code: data.referral_code || undefined },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (error) { toast.error(error.message); return }

      // Credit the welcome bonus right away. Don't rely on the user ever
      // clicking a confirmation-email link (email confirmation may be off
      // for this project, or the email may not arrive) — the callback
      // route still handles it too, but only as an idempotent fallback.
      if (signUpData.user) {
        try {
          await fetch("/api/auth/credit-signup-bonus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: signUpData.user.id,
              referral_code: data.referral_code || undefined,
            }),
          })
        } catch {
          // Non-fatal — the /api/auth/callback path will still credit it
          // once the account is confirmed/used for the first time.
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
            <Input id="referral_code" placeholder="e.g. ABC12345" className="pl-9 uppercase" {...register("referral_code")} />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
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
