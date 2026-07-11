"use client"
import { useState } from "react"
import { Loader2, Shield, KeyRound, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword]         = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading]                 = useState(false)
  const [showCurrent, setShowCurrent]         = useState(false)
  const [showNew, setShowNew]                 = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)

  const strength = passwordStrength(newPassword)

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match"); return }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return }
    setLoading(true)
    const supabase = createClient()

    // Re-authenticate with current password
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { toast.error("Not authenticated"); setLoading(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email, password: currentPassword,
    })
    if (signInError) { toast.error("Current password is incorrect"); setLoading(false); return }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { toast.error(error.message); setLoading(false); return }

    toast.success("Password changed successfully!")
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your password and account security settings.</p>
      </div>

      {/* Change password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowCurrent(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowNew(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength.score
                      ? strength.score <= 1 ? "bg-red-500" : strength.score <= 2 ? "bg-amber-500" : "bg-emerald-500"
                      : "bg-muted"}`} />
                  ))}
                </div>
                <p className={`text-xs font-medium ${strength.score <= 1 ? "text-red-500" : strength.score <= 2 ? "text-amber-500" : "text-emerald-600"}`}>
                  {strength.label}
                </p>
                {strength.tips.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {strength.tips.map(t => <li key={t}>• {t}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className={`pr-10 ${confirmPassword && confirmPassword !== newPassword ? "border-destructive" : ""}`}
              />
              <button type="button" onClick={() => setShowConfirm(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="gradient"
              onClick={handleChangePassword}
              disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword}
            >
              {loading && <Loader2 className="animate-spin" />}
              Update password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security tips */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" /> Security Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {[
              "Use a unique password not shared with any other service.",
              "Never share your password or OTP with anyone — including BountyTask staff.",
              "Log out of shared devices after each session.",
              "If you suspect your account is compromised, change your password immediately and contact support.",
              "We will never ask for your bank account PIN or internet banking password.",
            ].map(tip => (
              <li key={tip} className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function passwordStrength(pwd: string): { score: number; label: string; tips: string[] } {
  if (!pwd) return { score: 0, label: "", tips: [] }
  const tips: string[] = []
  let score = 0
  if (pwd.length >= 8) score++; else tips.push("Use at least 8 characters")
  if (/[A-Z]/.test(pwd)) score++; else tips.push("Add an uppercase letter")
  if (/[0-9]/.test(pwd)) score++; else tips.push("Add a number")
  if (/[^A-Za-z0-9]/.test(pwd)) score++; else tips.push("Add a special character (!@#$...)")
  const labels = ["", "Weak", "Fair", "Good", "Strong"]
  return { score, label: labels[score] ?? "Strong", tips }
}
