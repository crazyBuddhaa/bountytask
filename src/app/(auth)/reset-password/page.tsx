"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Lock, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    let active = true
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionReady(true)
        setVerifying(false)
      }
    })

    async function initRecoverySession() {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        const tokenHash = url.searchParams.get("token_hash")
        const type = url.searchParams.get("type")

        // 1. Handle PKCE ?code= if landed directly on /reset-password
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error && active) {
            setSessionReady(true)
            setVerifying(false)
            return
          }
        }

        // 2. Handle ?token_hash=...&type=recovery if landed directly
        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          })
          if (!error && active) {
            setSessionReady(true)
            setVerifying(false)
            return
          }
        }

        // 3. Handle implicit #access_token=...&refresh_token=... hash fragment
        if (window.location.hash && window.location.hash.includes("access_token=")) {
          const hashParams = new URLSearchParams(window.location.hash.slice(1))
          const accessToken = hashParams.get("access_token")
          const refreshToken = hashParams.get("refresh_token")
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (!error && active) {
              setSessionReady(true)
              setVerifying(false)
              return
            }
          }
        }

        // 4. Otherwise check existing session (exchanged by /api/auth/callback)
        const { data: { session } } = await supabase.auth.getSession()
        if (active) {
          setSessionReady(Boolean(session))
          setVerifying(false)
        }
      } catch {
        if (active) {
          setSessionReady(false)
          setVerifying(false)
        }
      }
    }

    initRecoverySession()
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success("Password updated successfully!")
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="animate-slide-up py-12 text-center space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="animate-slide-up text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Reset link expired or invalid</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This password reset link is no longer valid or was already used. Request a fresh link to continue.
        </p>
        <div className="pt-2 space-y-2">
          <Button variant="gradient" className="w-full" asChild>
            <Link href="/forgot-password">Request a new reset link</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/sign-in">Back to Sign In</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Set a new password</h2>
        <p className="text-muted-foreground mt-1">
          Choose a strong password of at least 8 characters.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              className="pl-9"
              {...register("password")}
            />
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className="pl-9"
              {...register("confirmPassword")}
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Update Password
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Need a new reset link?{" "}
        <Link href="/forgot-password" className="text-primary font-medium hover:underline">
          Request another
        </Link>
      </p>
    </div>
  )
}
