"use client"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Loader2, Save, Settings2, CreditCard, Building2, Smartphone,
  Banknote, Megaphone, LayoutTemplate, PlayCircle, LayoutGrid,
  Layers, ClipboardList, Key, Gift,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Settings = {
  // Withdrawal & verification
  verification_fee_enabled: boolean
  verification_fee_amount: number
  verification_payment_method: "paystack" | "bank_transfer"
  bank_transfer_name: string
  bank_transfer_number: string
  bank_transfer_bank: string
  phone_verification_enabled: boolean
  min_withdrawal_kobo: number
  // Advertiser
  advertiser_submissions_enabled: boolean
  advertiser_min_budget_kobo: number
  advertiser_requirements: string
  advertiser_pricing_info: string
  advertiser_contact_email: string
  advertiser_submission_fee_enabled: boolean
  advertiser_submission_fee_kobo: number
  // Display ads (AdSense snippets)
  ads_enabled: boolean
  ads_dashboard_snippet: string
  ads_tasklist_snippet: string
  // IMA SDK
  ima_enabled: boolean
  ima_daily_cap: number
  ima_reward_kobo: number
  ima_ad_tag_url: string
  // Lootably
  lootably_enabled: boolean
  lootably_daily_cap: number
  lootably_api_key: string
  lootably_secret: string
  // Ayet Studios
  ayet_enabled: boolean
  ayet_daily_cap: number
  ayet_placement_key: string
  ayet_secret_key: string
  // CPX Research
  cpx_enabled: boolean
  cpx_daily_cap: number
  cpx_app_id: string
  cpx_secure_hash_key: string
  // AdGate Media
  adgate_enabled: boolean
  adgate_daily_cap: number
  adgate_wall_id: string
  adgate_postback_ip: string
  // Adsterra Smartlink
  asterra_enabled: boolean
  asterra_daily_cap: number
  asterra_reward_kobo: number
  asterra_smartlink_url: string
}

const DEFAULTS: Settings = {
  verification_fee_enabled: false,
  verification_fee_amount: 50000,
  verification_payment_method: "paystack",
  bank_transfer_name: "",
  bank_transfer_number: "",
  bank_transfer_bank: "",
  phone_verification_enabled: false,
  min_withdrawal_kobo: 500000,
  advertiser_submissions_enabled: false,
  advertiser_min_budget_kobo: 500000,
  advertiser_requirements: "",
  advertiser_pricing_info: "",
  advertiser_contact_email: "",
  advertiser_submission_fee_enabled: false,
  advertiser_submission_fee_kobo: 500000,
  ads_enabled: false,
  ads_dashboard_snippet: "",
  ads_tasklist_snippet: "",
  ima_enabled: false,
  ima_daily_cap: 2,
  ima_reward_kobo: 50,
  ima_ad_tag_url: "",
  lootably_enabled: false,
  lootably_daily_cap: 10,
  lootably_api_key: "",
  lootably_secret: "",
  ayet_enabled: false,
  ayet_daily_cap: 10,
  ayet_placement_key: "",
  ayet_secret_key: "",
  cpx_enabled: false,
  cpx_daily_cap: 10,
  cpx_app_id: "",
  cpx_secure_hash_key: "",
  adgate_enabled: false,
  adgate_daily_cap: 10,
  adgate_wall_id: "",
  adgate_postback_ip: "",
  asterra_enabled: false,
  asterra_daily_cap: 3,
  asterra_reward_kobo: 250,
  asterra_smartlink_url: "",
}

const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://bountytask.dpdns.org"

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setSettings({
            verification_fee_enabled:    data.verification_fee_enabled    ?? false,
            verification_fee_amount:     data.verification_fee_amount      ?? 50000,
            verification_payment_method: data.verification_payment_method  ?? "paystack",
            bank_transfer_name:          data.bank_transfer_name           ?? "",
            bank_transfer_number:        data.bank_transfer_number         ?? "",
            bank_transfer_bank:          data.bank_transfer_bank           ?? "",
            phone_verification_enabled:  data.phone_verification_enabled   ?? false,
            min_withdrawal_kobo:         data.min_withdrawal_kobo          ?? 500000,
            advertiser_submissions_enabled:    data.advertiser_submissions_enabled    ?? false,
            advertiser_min_budget_kobo:        data.advertiser_min_budget_kobo         ?? 500000,
            advertiser_requirements:           data.advertiser_requirements            ?? "",
            advertiser_pricing_info:           data.advertiser_pricing_info            ?? "",
            advertiser_contact_email:          data.advertiser_contact_email           ?? "",
            advertiser_submission_fee_enabled: data.advertiser_submission_fee_enabled ?? false,
            advertiser_submission_fee_kobo:    data.advertiser_submission_fee_kobo     ?? 500000,
            ads_enabled:           data.ads_enabled           ?? false,
            ads_dashboard_snippet: data.ads_dashboard_snippet ?? "",
            ads_tasklist_snippet:  data.ads_tasklist_snippet  ?? "",
            ima_enabled:     data.ima_enabled     ?? false,
            ima_daily_cap:   data.ima_daily_cap   ?? 2,
            ima_reward_kobo: data.ima_reward_kobo ?? 50,
            ima_ad_tag_url:  data.ima_ad_tag_url  ?? "",
            lootably_enabled:   data.lootably_enabled   ?? false,
            lootably_daily_cap: data.lootably_daily_cap ?? 10,
            lootably_api_key:   data.lootably_api_key   ?? "",
            lootably_secret:    data.lootably_secret    ?? "",
            ayet_enabled:       data.ayet_enabled       ?? false,
            ayet_daily_cap:     data.ayet_daily_cap     ?? 10,
            ayet_placement_key: data.ayet_placement_key ?? "",
            ayet_secret_key:    data.ayet_secret_key    ?? "",
            cpx_enabled:         data.cpx_enabled          ?? false,
            cpx_daily_cap:       data.cpx_daily_cap         ?? 10,
            cpx_app_id:          data.cpx_app_id            ?? "",
            cpx_secure_hash_key: data.cpx_secure_hash_key   ?? "",
            adgate_enabled:      data.adgate_enabled       ?? false,
            adgate_daily_cap:    data.adgate_daily_cap     ?? 10,
            adgate_wall_id:      data.adgate_wall_id       ?? "",
            adgate_postback_ip:  data.adgate_postback_ip   ?? "",
            asterra_enabled:       data.asterra_enabled       ?? false,
            asterra_daily_cap:     data.asterra_daily_cap     ?? 3,
            asterra_reward_kobo:   data.asterra_reward_kobo   ?? 250,
            asterra_smartlink_url: data.asterra_smartlink_url ?? "",
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    const json = await res.json()
    if (json.error) toast.error(json.error)
    else toast.success("Settings saved")
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  const feeNaira = Math.round(settings.verification_fee_amount / 100)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="w-6 h-6" /> Platform Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure withdrawals, verification, advertiser intake, display ads, and rewarded ad providers.
        </p>
      </div>

      {/* ── Minimum Withdrawal ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="w-4 h-4" /> Minimum Withdrawal
          </CardTitle>
          <CardDescription>
            The smallest amount a user is allowed to withdraw in a single request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="min_withdrawal">Minimum Amount (₦)</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">₦</span>
            <Input
              id="min_withdrawal"
              type="number"
              min={1}
              step={100}
              value={Math.round(settings.min_withdrawal_kobo / 100)}
              onChange={(e) =>
                setSettings((s) => ({ ...s, min_withdrawal_kobo: Math.round(Number(e.target.value) * 100) }))
              }
              className="w-40"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Currently ₦{Math.round(settings.min_withdrawal_kobo / 100).toLocaleString("en-NG")}
          </p>
        </CardContent>
      </Card>

      {/* ── Withdrawal Verification Fee ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Withdrawal Verification Fee</CardTitle>
          <CardDescription>
            When enabled, users must pay this one-time fee before their first withdrawal.
            Registration itself always stays free.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Require verification fee</p>
              <p className="text-xs text-muted-foreground">Toggle to enable or disable the fee globally</p>
            </div>
            <Switch
              checked={settings.verification_fee_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, verification_fee_enabled: v }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fee_amount">Fee Amount (₦)</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">₦</span>
              <Input
                id="fee_amount"
                type="number"
                min={100}
                step={50}
                value={feeNaira}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, verification_fee_amount: Math.round(Number(e.target.value) * 100) }))
                }
                className="w-40"
                disabled={!settings.verification_fee_enabled}
              />
            </div>
            <p className="text-xs text-muted-foreground">Currently set to ₦{feeNaira.toLocaleString("en-NG")}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Payment Method ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Method</CardTitle>
          <CardDescription>How users will pay the verification fee before withdrawing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["paystack", "bank_transfer"] as const).map((method) => {
              const active = settings.verification_payment_method === method
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, verification_payment_method: method }))}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all ${
                    active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {method === "paystack" ? <CreditCard className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-primary" />}
                  <span className="text-sm font-medium capitalize">
                    {method === "paystack" ? "Paystack (online)" : "Bank Transfer"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {method === "paystack" ? "Instant verification via Paystack popup" : "User transfers manually, admin approves"}
                  </span>
                </button>
              )
            })}
          </div>
          {settings.verification_payment_method === "bank_transfer" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground">Your bank account details</p>
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input id="bank_name" placeholder="e.g. GTBank" value={settings.bank_transfer_bank}
                  onChange={(e) => setSettings((s) => ({ ...s, bank_transfer_bank: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input id="account_number" placeholder="0123456789" value={settings.bank_transfer_number}
                  onChange={(e) => setSettings((s) => ({ ...s, bank_transfer_number: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_name">Account Name</Label>
                <Input id="account_name" placeholder="BountyTask Nigeria" value={settings.bank_transfer_name}
                  onChange={(e) => setSettings((s) => ({ ...s, bank_transfer_name: e.target.value }))} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Phone Verification ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Phone Verification
          </CardTitle>
          <CardDescription>
            When enabled, users must verify a phone number via SMS before their first withdrawal.
            Requires TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID to be set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Require phone verification</p>
              <p className="text-xs text-muted-foreground">Toggle to enable or disable globally</p>
            </div>
            <Switch
              checked={settings.phone_verification_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, phone_verification_enabled: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Advertiser Submissions ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> Advertiser Submissions
          </CardTitle>
          <CardDescription>
            Lets outside businesses submit task requests via <code>/advertise</code>. Every submission
            lands as a pending lead — nothing goes live until you approve it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Accept advertiser submissions</p>
              <p className="text-xs text-muted-foreground">Toggle the intake form on or off</p>
            </div>
            <Switch
              checked={settings.advertiser_submissions_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, advertiser_submissions_enabled: v }))}
            />
          </div>
          {settings.advertiser_submissions_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="adv_min_budget">Minimum Budget (₦)</Label>
                <Input id="adv_min_budget" type="number"
                  value={Math.round(settings.advertiser_min_budget_kobo / 100)}
                  onChange={(e) => setSettings((s) => ({ ...s, advertiser_min_budget_kobo: (parseInt(e.target.value) || 0) * 100 }))} />
                <p className="text-xs text-muted-foreground">Submissions below this budget are rejected automatically.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adv_contact_email">Contact Email</Label>
                <Input id="adv_contact_email" type="email" placeholder="partners@bountytask.ng"
                  value={settings.advertiser_contact_email}
                  onChange={(e) => setSettings((s) => ({ ...s, advertiser_contact_email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adv_requirements">Requirements</Label>
                <Textarea id="adv_requirements" rows={3} value={settings.advertiser_requirements}
                  onChange={(e) => setSettings((s) => ({ ...s, advertiser_requirements: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adv_pricing">Pricing Details</Label>
                <Textarea id="adv_pricing" rows={3} value={settings.advertiser_pricing_info}
                  onChange={(e) => setSettings((s) => ({ ...s, advertiser_pricing_info: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm font-medium">Charge a submission fee</p>
                  <p className="text-xs text-muted-foreground">Advertiser pays via Paystack before the lead reaches review</p>
                </div>
                <Switch
                  checked={settings.advertiser_submission_fee_enabled}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, advertiser_submission_fee_enabled: v }))}
                />
              </div>
              {settings.advertiser_submission_fee_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="adv_fee">Submission Fee (₦)</Label>
                  <Input id="adv_fee" type="number"
                    value={Math.round(settings.advertiser_submission_fee_kobo / 100)}
                    onChange={(e) => setSettings((s) => ({ ...s, advertiser_submission_fee_kobo: (parseInt(e.target.value) || 0) * 100 }))} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Display Ads (AdSense snippets) ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4" /> Display Ads (AdSense)
          </CardTitle>
          <CardDescription>
            Paste your Google AdSense (or any network) HTML snippet for passive banner placements.
            Use manual ad units — not Auto Ads — to control exact placement. Keep units visually
            separated from reward UI to comply with AdSense policy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable display ads</p>
              <p className="text-xs text-muted-foreground">Toggle all passive ad placements on or off</p>
            </div>
            <Switch
              checked={settings.ads_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, ads_enabled: v }))}
            />
          </div>
          {settings.ads_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ads_dashboard">Dashboard Placement</Label>
                <Textarea id="ads_dashboard" rows={3} placeholder='<script async src="..."></script>'
                  value={settings.ads_dashboard_snippet}
                  onChange={(e) => setSettings((s) => ({ ...s, ads_dashboard_snippet: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Shown at the top of the worker dashboard.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ads_tasklist">Task List Placement</Label>
                <Textarea id="ads_tasklist" rows={3} placeholder='<script async src="..."></script>'
                  value={settings.ads_tasklist_snippet}
                  onChange={(e) => setSettings((s) => ({ ...s, ads_tasklist_snippet: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Shown between filters and grid on the Tasks page.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Google IMA SDK ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PlayCircle className="w-4 h-4" /> Google IMA SDK — Watch an Ad
          </CardTitle>
          <CardDescription>
            Rewarded video ads via Google IMA (VAST). Hard capped at 2 views per user per day to
            stay within AdSense invalid-traffic policy. Requires a VAST ad tag URL from Google Ad Manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable IMA rewarded video</p>
            </div>
            <Switch
              checked={settings.ima_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, ima_enabled: v }))}
            />
          </div>
          {settings.ima_enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ima_cap">Daily cap per user</Label>
                  <Input id="ima_cap" type="number" min={1} max={10}
                    value={settings.ima_daily_cap}
                    onChange={(e) => setSettings((s) => ({ ...s, ima_daily_cap: parseInt(e.target.value) || 2 }))} />
                  <p className="text-xs text-muted-foreground">Max 10. Recommended: 2.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ima_reward">Reward per view (₦)</Label>
                  <Input id="ima_reward" type="number" min={1}
                    value={Math.round(settings.ima_reward_kobo / 100)}
                    onChange={(e) => setSettings((s) => ({ ...s, ima_reward_kobo: Math.round(Number(e.target.value) * 100) }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ima_tag" className="flex items-center gap-1"><Key className="w-3 h-3" /> VAST Ad Tag URL</Label>
                <Input id="ima_tag" placeholder="https://pubads.g.doubleclick.net/gampad/ads?..."
                  value={settings.ima_ad_tag_url}
                  onChange={(e) => setSettings((s) => ({ ...s, ima_ad_tag_url: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Generate from Google Ad Manager → Ad units → VAST tag.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Lootably ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> Lootably — Mixed Offers
          </CardTitle>
          <CardDescription>
            Aggregated offer wall: surveys, video offers, sign-ups, and app installs.
            Broadest offer variety — best used as a fallback when specialist walls have low fill.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Enable Lootably</p></div>
            <Switch
              checked={settings.lootably_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, lootably_enabled: v }))}
            />
          </div>
          {settings.lootably_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="lootably_cap">Daily cap per user</Label>
                <Input id="lootably_cap" type="number" min={1} max={20}
                  value={settings.lootably_daily_cap}
                  onChange={(e) => setSettings((s) => ({ ...s, lootably_daily_cap: parseInt(e.target.value) || 10 }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lootably_key" className="flex items-center gap-1"><Key className="w-3 h-3" /> API Key</Label>
                <Input id="lootably_key" placeholder="lootably-api-key"
                  value={settings.lootably_api_key}
                  onChange={(e) => setSettings((s) => ({ ...s, lootably_api_key: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lootably_secret" className="flex items-center gap-1"><Key className="w-3 h-3" /> Postback Secret</Label>
                <Input id="lootably_secret" type="password" placeholder="HMAC-SHA256 signing secret"
                  value={settings.lootably_secret}
                  onChange={(e) => setSettings((s) => ({ ...s, lootably_secret: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  Postback URL: <code className="text-xs bg-muted px-1 rounded">{APP_URL}/api/postback/lootably</code>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Ayet Studios ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4" /> Ayet Studios — Surveys &amp; Offers
          </CardTitle>
          <CardDescription>
            Strong survey and offer inventory — recommended as the primary offer wall for Nigerian
            traffic. Offerwall postbacks are authenticated with a static secret you control (not
            HMAC). Reversal callbacks are supported — enable them in the Ayet dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Enable Ayet Studios</p></div>
            <Switch
              checked={settings.ayet_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, ayet_enabled: v }))}
            />
          </div>
          {settings.ayet_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ayet_cap">Daily cap per user</Label>
                <Input id="ayet_cap" type="number" min={1} max={20}
                  value={settings.ayet_daily_cap}
                  onChange={(e) => setSettings((s) => ({ ...s, ayet_daily_cap: parseInt(e.target.value) || 10 }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ayet_placement" className="flex items-center gap-1">
                  <Key className="w-3 h-3" /> Placement Key
                </Label>
                <Input id="ayet_placement" placeholder="e.g. pl-23749"
                  value={settings.ayet_placement_key}
                  onChange={(e) => setSettings((s) => ({ ...s, ayet_placement_key: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  Found in Ayet dashboard → your placement → Overview (e.g. <code className="bg-muted px-1 rounded">PL-23749</code>).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ayet_secret" className="flex items-center gap-1">
                  <Key className="w-3 h-3" /> Postback Secret
                </Label>
                <Input id="ayet_secret" type="password" placeholder="Random secret you generated (e.g. openssl rand -hex 24)"
                  value={settings.ayet_secret_key}
                  onChange={(e) => setSettings((s) => ({ ...s, ayet_secret_key: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  A random token <strong>you choose</strong> — not provided by Ayet. Ayet offerwall
                  postbacks carry no HMAC; this static secret appended to the callback URL is the
                  only auth mechanism. Generate one with{" "}
                  <code className="bg-muted px-1 rounded">openssl rand -hex 24</code>, paste it
                  here, then paste the same value into the callback URL below.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Key className="w-3 h-3" /> Conversion Callback URL
                </Label>
                <div className="relative">
                  <code className="block text-xs bg-muted rounded p-3 pr-10 break-all leading-relaxed select-all">
                    {`${APP_URL}/api/postback/ayet?uid={external_identifier}&txn_id={transaction_id}&payout_usd={payout_usd}&currency={currency_amount}&chargeback={is_chargeback}&secret=`}
                    {settings.ayet_secret_key
                      ? <span className="text-green-600 dark:text-green-400">{settings.ayet_secret_key}</span>
                      : <span className="text-destructive">YOUR_SECRET_HERE</span>}
                  </code>
                  <button
                    type="button"
                    className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                    title="Copy callback URL"
                    onClick={() => {
                      const secret = settings.ayet_secret_key || "YOUR_SECRET_HERE"
                      navigator.clipboard.writeText(
                        `${APP_URL}/api/postback/ayet?uid={external_identifier}&txn_id={transaction_id}&payout_usd={payout_usd}&currency={currency_amount}&chargeback={is_chargeback}&secret=${secret}`
                      )
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                  </button>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li><code className="bg-muted px-1 rounded">{"{external_identifier}"}</code> — your internal user ID</li>
                  <li><code className="bg-muted px-1 rounded">{"{transaction_id}"}</code> — dedup key; reversals reuse the same ID</li>
                  <li><code className="bg-muted px-1 rounded">{"{payout_usd}"}</code> — actual USD value, converted to NGN at credit time</li>
                  <li><code className="bg-muted px-1 rounded">{"{is_chargeback}"}</code> — 0 on completion, 1 on reversal (enable Reversal Callbacks in Ayet dashboard)</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── CPX Research ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> CPX Research — Surveys
          </CardTitle>
          <CardDescription>
            Survey-specialist network with the best Nigerian fill rate in this stack. MD5-hashed
            postbacks. Rewards are variable (CPX sets the amount per survey); configure a default
            fallback reward for surveys with no explicit payout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Enable CPX Research</p></div>
            <Switch
              checked={settings.cpx_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, cpx_enabled: v }))}
            />
          </div>
          {settings.cpx_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cpx_cap">Daily cap per user</Label>
                <Input id="cpx_cap" type="number" min={1} max={20}
                  value={settings.cpx_daily_cap}
                  onChange={(e) => setSettings((s) => ({ ...s, cpx_daily_cap: parseInt(e.target.value) || 10 }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpx_app_id" className="flex items-center gap-1"><Key className="w-3 h-3" /> App ID</Label>
                <Input id="cpx_app_id" placeholder="cpx-app-id"
                  value={settings.cpx_app_id}
                  onChange={(e) => setSettings((s) => ({ ...s, cpx_app_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpx_hash_key" className="flex items-center gap-1"><Key className="w-3 h-3" /> Secure Hash Key</Label>
                <Input id="cpx_hash_key" type="password" placeholder="MD5 hash key"
                  value={settings.cpx_secure_hash_key}
                  onChange={(e) => setSettings((s) => ({ ...s, cpx_secure_hash_key: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  Found in your CPX Research dashboard under <strong>App Settings → Security</strong>.
                  Used to verify every postback via MD5(<code className="bg-muted px-1 rounded">appId-userId-transId-key</code>).
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Key className="w-3 h-3" /> Postback URL
                </Label>
                <div className="relative">
                  <code className="block text-xs bg-muted rounded p-3 pr-10 break-all leading-relaxed select-all">
                    {`${APP_URL}/api/postback/cpx?user_id={user_id}&trans_id={trans_id}&status={status}&hash={secure_hash}&amount_usd={amount_usd}`}
                  </code>
                  <button
                    type="button"
                    className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                    title="Copy postback URL"
                    onClick={() => navigator.clipboard.writeText(`${APP_URL}/api/postback/cpx?user_id={user_id}&trans_id={trans_id}&status={status}&hash={secure_hash}&amount_usd={amount_usd}`)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy this <strong>exact URL including the placeholders</strong> into CPX Research → your App → <strong>Postback Settings</strong> tab → Main Postback URL. CPX substitutes each <code className="bg-muted px-1 rounded">{"{placeholder}"}</code> with real values on every postback.
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li><code className="bg-muted px-1 rounded">{"{user_id}"}</code> — your internal user ID (echoed from the survey wall)</li>
                  <li><code className="bg-muted px-1 rounded">{"{trans_id}"}</code> — unique transaction ID used for deduplication</li>
                  <li><code className="bg-muted px-1 rounded">{"{status}"}</code> — <code className="bg-muted px-1 rounded">1</code> = completed, <code className="bg-muted px-1 rounded">2</code> = canceled/fraud</li>
                  <li><code className="bg-muted px-1 rounded">{"{secure_hash}"}</code> — MD5(<code className="bg-muted px-1 rounded">trans_id-secureHashKey</code>), verified server-side</li>
                  <li><code className="bg-muted px-1 rounded">{"{amount_usd}"}</code> — USD payout, converted to ₦ at credit time</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── AdGate Media ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-4 h-4" /> AdGate Media — Rewards Wall
          </CardTitle>
          <CardDescription>
            App installs, sign-ups, and offer wall. Postbacks are verified by source IP
            (shown on your AdGate affiliate panel under the wall&apos;s Postback section) rather
            than a signed hash — enter that IP below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Enable AdGate Media</p></div>
            <Switch
              checked={settings.adgate_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, adgate_enabled: v }))}
            />
          </div>
          {settings.adgate_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="adgate_cap">Daily cap per user</Label>
                <Input id="adgate_cap" type="number" min={1} max={20}
                  value={settings.adgate_daily_cap}
                  onChange={(e) => setSettings((s) => ({ ...s, adgate_daily_cap: parseInt(e.target.value) || 10 }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adgate_wall_id" className="flex items-center gap-1"><Key className="w-3 h-3" /> Wall ID</Label>
                <Input id="adgate_wall_id" placeholder="e.g. nQ"
                  value={settings.adgate_wall_id}
                  onChange={(e) => setSettings((s) => ({ ...s, adgate_wall_id: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  Found at panel.adgatemedia.com under Monetization Tools → AdGate Rewards → your VC wall.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adgate_postback_ip" className="flex items-center gap-1"><Key className="w-3 h-3" /> Postback Source IP</Label>
                <Input id="adgate_postback_ip" placeholder="e.g. 123.123.123.123"
                  value={settings.adgate_postback_ip}
                  onChange={(e) => setSettings((s) => ({ ...s, adgate_postback_ip: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  Postback URL: <code className="text-xs bg-muted px-1 rounded">{`${APP_URL}/api/postback/adgate?conversion_id={conversion_id}&user_id={s1}&payout={payout}&state={state}`}</code>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Adsterra Smartlink ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> Adsterra — Sponsored Link
          </CardTitle>
          <CardDescription>
            <strong>Aggregate revenue model</strong> — Adsterra pays you as a publisher in aggregate
            (CPM/CPA on total traffic), not per confirmed user conversion. There is no per-user
            postback. Rewards are a fixed internal amount you set, credited optimistically at click
            time from your own margin.{" "}
            <strong>Reconcile weekly:</strong> compare total ledger payout for this provider
            against actual Adsterra revenue received; cut the reward if you&apos;re paying out more
            than you earn. Keep the daily cap conservative (2–3/day).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Enable Adsterra Smartlink</p></div>
            <Switch
              checked={settings.asterra_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, asterra_enabled: v }))}
            />
          </div>
          {settings.asterra_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="asterra_cap">Daily cap per user</Label>
                <Input id="asterra_cap" type="number" min={1} max={10}
                  value={settings.asterra_daily_cap}
                  onChange={(e) => setSettings((s) => ({ ...s, asterra_daily_cap: parseInt(e.target.value) || 3 }))} />
                <p className="text-xs text-muted-foreground">
                  Keep this at 2–3. No postback confirmation means your daily cap is the only
                  fraud control here. 30-minute cooldown between clicks is enforced server-side.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asterra_reward">Reward per click (kobo)</Label>
                <Input id="asterra_reward" type="number" min={1}
                  value={settings.asterra_reward_kobo}
                  onChange={(e) => setSettings((s) => ({ ...s, asterra_reward_kobo: parseInt(e.target.value) || 250 }))} />
                <p className="text-xs text-muted-foreground">
                  250 kobo = ₦2.50. Start conservative and raise only after confirming your
                  Adsterra revenue covers the payout. Nigerian/West African CPMs are low.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asterra_url" className="flex items-center gap-1">
                  <Key className="w-3 h-3" /> Smartlink URL
                </Label>
                <Input id="asterra_url" placeholder="https://smartlink.adsterra.com/..."
                  value={settings.asterra_smartlink_url}
                  onChange={(e) => setSettings((s) => ({ ...s, asterra_smartlink_url: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  From your Adsterra publisher dashboard → Smartlink. Create a <strong>separate
                  smartlink per placement</strong> so Adsterra&apos;s own analytics show which surface
                  earns — the network won&apos;t give you per-user breakdowns.{" "}
                  <code className="bg-muted px-1 rounded">sub1=userId</code> is appended
                  automatically.
                </p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-medium">ads.txt reminder</p>
                <p>
                  Check your Adsterra publisher dashboard for the required{" "}
                  <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">ads.txt</code>{" "}
                  entry and add it to <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">public/ads.txt</code> alongside the Ayet line.
                  Adsterra will not serve properly without it.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4" />}
        Save Settings
      </Button>
    </div>
  )
}
