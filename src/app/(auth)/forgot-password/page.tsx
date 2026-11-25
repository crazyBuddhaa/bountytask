"use client"
import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Mail, CheckCircle2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  email: z.string().email("Enter a valid email"),
})
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sentEmail, setSentEmail] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const supabase = createClient()
      // Store recovery destination in a short-lived same-site cookie so redirectTo
      // stays the exact allowlisted `/api/auth/callback` URL (without query params
      // that Supabase's strict Redirect URL allowlist might reject).
      const secureFlag = window.location.protocol === "https:" ? "; Secure" : ""
      document.cookie = `bt_auth_next=/reset-password; Path=/; Max-Age=3600; SameSite=Lax${secureFlag}`

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      setSentEmail(data.email)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (sentEmail) {
    return (
      <div className="animate-slide-up text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If an account exists for <span className="font-medium text-foreground">{sentEmail}</span>, we&apos;ve sent a password reset link. Click the link in the email to choose a new password.
        </p>
        <div className="pt-2">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/sign-in">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Forgot your password?</h2>
        <p className="text-muted-foreground mt-1">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="pl-9"
              {...register("email")}
            />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Send Reset Link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Remembered your password?{" "}
        <Link href="/sign-in" className="text-primary font-medium hover:underline">
          Back to Sign In
        </Link>
      </p>
    </div>
  )
}
