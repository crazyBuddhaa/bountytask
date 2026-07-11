"use client"
import { useState, useEffect, useRef } from "react"
import { Loader2, Camera, User } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { uploadFile } from "@/lib/storage"
import { createClient } from "@/lib/supabase/client"
import type { UserProfile } from "@/types"

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName]   = useState("")
  const [username, setUsername]   = useState("")
  const [phone, setPhone]         = useState("")

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(j => {
        const p = j.data as UserProfile & { balance: number }
        setProfile(p)
        setFullName(p?.full_name ?? "")
        setUsername(p?.username ?? "")
        setPhone(p?.phone ?? "")
        setLoading(false)
      })
  }, [])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("Avatar must be under 2 MB"); return }
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const url = await uploadFile("avatars", user.id, file)
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error); return }
      setProfile(prev => prev ? { ...prev, avatar_url: url } : prev)
      toast.success("Avatar updated!")
    } catch {
      toast.error("Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, username: username || null, phone: phone || null }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setSaving(false); return }
    setProfile(prev => prev ? { ...prev, ...json.data } : prev)
    toast.success("Profile saved!")
    setSaving(false)
  }

  const initials = profile?.full_name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() ?? "?"

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your public profile and account details.</p>
      </div>

      {/* Avatar section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative group">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-2xl bounty-gradient text-white">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              {uploading
                ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                : <Camera className="w-5 h-5 text-white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="font-medium">{loading ? <Skeleton className="h-5 w-32" /> : profile?.full_name}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={profile?.role === "admin" ? "default" : "outline"} className="text-[10px] capitalize">
                {profile?.role ?? "user"}
              </Badge>
              {profile?.kyc_verified && <Badge variant="success" className="text-[10px]">KYC Verified</Badge>}
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading..." : "Change photo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input id="username" className="pl-7" value={username} onChange={e => setUsername(e.target.value)} placeholder="yourhandle" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? ""} disabled className="bg-muted text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Email cannot be changed here. Contact support if needed.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234 800 000 0000" type="tel" />
              </div>
              <div className="space-y-1.5">
                <Label>Referral Code</Label>
                <Input value={profile?.referral_code ?? ""} disabled className="bg-muted font-mono tracking-widest" />
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="gradient" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />}
                  Save changes
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Account metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" />Account Info</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
          {[
            { label: "Member since", value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" }) : "—" },
            { label: "Account status", value: profile?.is_active !== false ? "Active" : "Inactive" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              {loading ? <Skeleton className="h-5 w-24 mt-1" /> : <p className="font-medium mt-1">{value}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
