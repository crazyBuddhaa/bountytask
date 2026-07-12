"use client"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, Megaphone, Send, Users, User as UserIcon, Bell, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Target = "all" | "user"
type Channel = "in_app" | "email"

interface UserOption { id: string; email: string; full_name: string | null }

export default function AdminNotificationsPage() {
  const [target, setTarget] = useState<Target>("all")
  const [search, setSearch] = useState("")
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [searching, setSearching] = useState(false)

  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [channels, setChannels] = useState<Channel[]>(["in_app"])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (target !== "user" || search.trim().length < 2) { setUserOptions([]); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}&limit=10`)
      const json = await res.json()
      setUserOptions(json.data ?? [])
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [search, target])

  function toggleChannel(c: Channel) {
    setChannels((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) { toast.error("Title and message are required"); return }
    if (channels.length === 0) { toast.error("Choose at least one delivery channel"); return }
    if (target === "user" && !selectedUserId) { toast.error("Select a user"); return }

    setSending(true)
    const res = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        userId: target === "user" ? selectedUserId : undefined,
        title: title.trim(),
        message: message.trim(),
        channels,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? "Failed to send notification")
    } else {
      toast.success(`Sent to ${json.data.recipientCount} recipient${json.data.recipientCount === 1 ? "" : "s"}`)
      setTitle(""); setMessage(""); setSelectedUserId(""); setSearch("")
    }
    setSending(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="w-6 h-6" /> Notifications
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Send an announcement to every user, or a message to one specific user.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audience</CardTitle>
          <CardDescription>Choose who should receive this notification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "all" as const,  label: "All users",      desc: "Every active account on the platform", icon: Users },
              { value: "user" as const, label: "Specific user",  desc: "Search for one user by name or email", icon: UserIcon },
            ]).map(({ value, label, desc, icon: Icon }) => {
              const active = target === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTarget(value)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </button>
              )
            })}
          </div>

          {target === "user" && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Label htmlFor="user_search">Find user</Label>
              <Input
                id="user_search"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedUserId("") }}
              />
              {searching && <p className="text-xs text-muted-foreground">Searching...</p>}
              {!searching && search.trim().length >= 2 && (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger><SelectValue placeholder={userOptions.length ? "Select user" : "No matches"} /></SelectTrigger>
                  <SelectContent>
                    {userOptions.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name ?? "Unnamed"} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notif_title">Title</Label>
            <Input id="notif_title" placeholder="e.g. Scheduled maintenance tonight"
              value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notif_message">Message</Label>
            <Textarea id="notif_message" placeholder="Write the notification body..." rows={5}
              value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Channels</CardTitle>
          <CardDescription>Send as an in-platform notification, an email, or both.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "in_app" as const, label: "In-platform", desc: "Shows in the notification bell", icon: Bell },
              { value: "email" as const,  label: "Email",       desc: "Sent to the user's email address", icon: Mail },
            ]).map(({ value, label, desc, icon: Icon }) => {
              const active = channels.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleChannel(value)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Select both to deliver the same message through both channels at once.
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSend} disabled={sending} className="w-full sm:w-auto">
        {sending ? <Loader2 className="animate-spin" /> : <Send className="w-4 h-4" />}
        Send Notification
      </Button>
    </div>
  )
}
