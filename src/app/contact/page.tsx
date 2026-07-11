"use client"
import { useState } from "react"
import { Loader2, Mail, MessageSquare, CheckCircle2 } from "lucide-react"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const topics = [
  "Withdrawal issue",
  "Task not credited",
  "Account access",
  "Referral bonus",
  "Fraud / abuse report",
  "General question",
  "Other",
]

export default function ContactPage() {
  const [name, setName]       = useState("")
  const [email, setEmail]     = useState("")
  const [topic, setTopic]     = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !topic || !message) return
    setSending(true)
    // Simulate — in production wire to Resend or a database table
    await new Promise(r => setTimeout(r, 1000))
    setSent(true)
    setSending(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="py-16 px-4 text-center border-b border-border bg-muted/20">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-extrabold mb-3">Contact Us</h1>
            <p className="text-muted-foreground">We respond within 24 hours on business days (Mon–Fri).</p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-start">
            {/* Info column */}
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold mb-4">Get in touch</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Have a question about your earnings, a withdrawal issue, or a task that didn&apos;t credit? Fill in the form and we&apos;ll get back to you as quickly as possible.
                </p>
              </div>
              <div className="space-y-4">
                {[
                  { icon: Mail,          title: "Email",   value: "support@bountytask.ng" },
                  { icon: MessageSquare, title: "Response time", value: "Within 24 business hours" },
                ].map(({ icon: Icon, title, value }) => (
                  <div key={title} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{title}</p>
                      <p className="font-medium text-sm">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form column */}
            <div className="rounded-2xl border border-border bg-card p-7">
              {sent ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold mb-2">Message sent!</h3>
                  <p className="text-muted-foreground text-sm">
                    Thank you for reaching out. We&apos;ll get back to you within 24 business hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input id="name" placeholder="Your name" value={name}
                        onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" placeholder="you@example.com" value={email}
                        onChange={e => setEmail(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Topic *</Label>
                    <Select value={topic} onValueChange={setTopic} required>
                      <SelectTrigger><SelectValue placeholder="What is your message about?" /></SelectTrigger>
                      <SelectContent>
                        {topics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea id="message" placeholder="Describe your issue or question in detail…"
                      rows={5} value={message} onChange={e => setMessage(e.target.value)} required />
                  </div>
                  <Button type="submit" variant="gradient" className="w-full" disabled={sending || !name || !email || !topic || !message}>
                    {sending && <Loader2 className="animate-spin" />}
                    {sending ? "Sending…" : "Send Message"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
