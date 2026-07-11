"use client"
import { useState, useEffect } from "react"
import { Copy, Check, Users, Gift, Share2, Trophy } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"

interface ReferralData {
  referral_code: string
  referral_url: string
  total_referred: number
  total_credited: number
  total_earned_kobo: number
  referrals: Array<{
    id: string
    bonus_credited: boolean
    bonus_amount: number
    credited_at: string | null
    created_at: string
    referred: { full_name: string; username: string; created_at: string } | null
  }>
}

export default function ReferralPage() {
  const [data, setData]       = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState<"code" | "url" | null>(null)

  useEffect(() => {
    fetch("/api/referrals")
      .then(r => r.json())
      .then(j => { setData(j.data); setLoading(false) })
  }, [])

  async function copy(value: string, type: "code" | "url") {
    await navigator.clipboard.writeText(value)
    setCopied(type)
    toast.success(type === "code" ? "Referral code copied!" : "Referral link copied!")
    setTimeout(() => setCopied(null), 2000)
  }

  const shareOnWhatsApp = () => {
    const text = `Join BountyTask and earn real ₦ completing tasks! Use my referral link: ${data?.referral_url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
  }

  const shareOnTwitter = () => {
    const text = `I'm earning real ₦ on BountyTask! Join with my referral link and we both get bonuses 🎁`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(data?.referral_url ?? "")}`, "_blank")
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Referral Program</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Earn <span className="font-semibold text-primary">₦500</span> for every friend who joins and completes their first task.
          Your friend gets a <span className="font-semibold text-primary">₦200</span> signup bonus too.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users,  label: "Friends Referred",    value: data?.total_referred  ?? 0,  format: (n: number) => n.toString()         },
          { icon: Trophy, label: "Bonuses Paid",        value: data?.total_credited  ?? 0,  format: (n: number) => n.toString()         },
          { icon: Gift,   label: "Total Earned",        value: data?.total_earned_kobo ?? 0, format: (n: number) => formatCurrency(n)   },
        ].map(({ icon: Icon, label, value, format }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                {loading
                  ? <Skeleton className="h-7 w-20 mt-1" />
                  : <p className="text-2xl font-bold">{format(value)}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referral code card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" /> Your Referral Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : (
            <>
              {/* Code */}
              <div className="flex items-center gap-3">
                <div className="flex-1 font-mono text-2xl font-bold tracking-widest text-center py-3 px-4 rounded-lg bg-primary/5 border border-primary/20 text-primary">
                  {data?.referral_code}
                </div>
                <Button variant="outline" size="icon" className="h-14 w-14 shrink-0"
                  onClick={() => copy(data?.referral_code ?? "", "code")}>
                  {copied === "code" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              {/* URL */}
              <div className="flex items-center gap-2">
                <div className="flex-1 text-xs text-muted-foreground truncate bg-muted rounded-lg px-3 py-2 font-mono">
                  {data?.referral_url}
                </div>
                <Button variant="outline" size="sm" onClick={() => copy(data?.referral_url ?? "", "url")}>
                  {copied === "url" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy link
                </Button>
              </div>

              {/* Share buttons */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={shareOnWhatsApp} className="gap-2">
                  <span className="text-base">💬</span> WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={shareOnTwitter} className="gap-2">
                  <span className="text-base">𝕏</span> Twitter / X
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Share your link", desc: "Send your unique referral code or link to friends via WhatsApp, Twitter, or direct message." },
              { step: "2", title: "Friend signs up", desc: "Your friend registers using your code and immediately receives a ₦200 signup bonus." },
              { step: "3", title: "Both get paid", desc: "Once they complete their first task, you receive a ₦500 referral bonus in your ledger." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bounty-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {step}
                </div>
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Referral table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Referrals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !data?.referrals.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No referrals yet. Share your link to start earning!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Friend</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.referrals.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">
                      {r.referred?.full_name ?? "—"}
                      {r.referred?.username && <span className="text-muted-foreground text-xs ml-1">@{r.referred.username}</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(r.referred?.created_at ?? r.created_at)}
                    </TableCell>
                    <TableCell className="font-bold text-sm">
                      {r.bonus_credited ? <span className="text-emerald-600">+{formatCurrency(r.bonus_amount)}</span> : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.bonus_credited ? "success" : "pending"} className="text-[10px]">
                        {r.bonus_credited ? "Credited" : "Awaiting first task"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
