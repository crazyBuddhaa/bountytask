"use client"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, Settings2, CreditCard, Building2, Smartphone, Banknote, Megaphone, LayoutTemplate } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Settings = {
  verification_fee_enabled: boolean
  verification_fee_amount: number
  verification_payment_method: "paystack" | "bank_transfer"
  bank_transfer_name: string
  bank_transfer_number: string
  bank_transfer_bank: string
  phone_verification_enabled: boolean
  min_withdrawal_kobo: number
  advertiser_submissions_enabled: boolean
  advertiser_min_budget_kobo: number
  advertiser_requirements: string
  advertiser_pricing_info: string
  advertiser_contact_email: string
  advertiser_submission_fee_enabled: boolean
  advertiser_submission_fee_kobo: number
  ads_enabled: boolean
  ads_dashboard_snippet: string
  ads_tasklist_snippet: string
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({
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
  })
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
            advertiser_requirements:          data.advertiser_requirements            ?? "",
            advertiser_pricing_info:          data.advertiser_pricing_info            ?? "",
            advertiser_contact_email:         data.advertiser_contact_email           ?? "",
            advertiser_submission_fee_enabled: data.advertiser_submission_fee_enabled ?? false,
            advertiser_submission_fee_kobo:   data.advertiser_submission_fee_kobo      ?? 500000,
            ads_enabled:            data.ads_enabled            ?? false,
            ads_dashboard_snippet:  data.ads_dashboard_snippet  ?? "",
            ads_tasklist_snippet:   data.ads_tasklist_snippet   ?? "",
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
    if (json.error) {
      toast.error(json.error)
    } else {
      toast.success("Settings saved")
    }
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
          Configure the minimum withdrawal, verification fee, payment method, and phone verification.
        </p>
      </div>

      {/* Minimum Withdrawal */}
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
                setSettings((s) => ({
                  ...s,
                  min_withdrawal_kobo: Math.round(Number(e.target.value) * 100),
                }))
              }
              className="w-40"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Currently ₦{Math.round(settings.min_withdrawal_kobo / 100).toLocaleString("en-NG")}
          </p>
        </CardContent>
      </Card>

      {/* Verification Fee Toggle */}
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
                  setSettings((s) => ({
                    ...s,
                    verification_fee_amount: Math.round(Number(e.target.value) * 100),
                  }))
                }
                className="w-40"
                disabled={!settings.verification_fee_enabled}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Currently set to ₦{feeNaira.toLocaleString("en-NG")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Method</CardTitle>
          <CardDescription>
            How users will pay the verification fee before withdrawing.
          </CardDescription>
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
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {method === "paystack" ? (
                    <CreditCard className="w-5 h-5 text-primary" />
                  ) : (
                    <Building2 className="w-5 h-5 text-primary" />
                  )}
                  <span className="text-sm font-medium capitalize">
                    {method === "paystack" ? "Paystack (online)" : "Bank Transfer"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {method === "paystack"
                      ? "Instant verification via Paystack popup"
                      : "User transfers manually, admin approves"}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Bank transfer details */}
          {settings.verification_payment_method === "bank_transfer" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground">Your bank account details</p>
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  placeholder="e.g. GTBank"
                  value={settings.bank_transfer_bank}
                  onChange={(e) => setSettings((s) => ({ ...s, bank_transfer_bank: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  placeholder="0123456789"
                  value={settings.bank_transfer_number}
                  onChange={(e) => setSettings((s) => ({ ...s, bank_transfer_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  placeholder="BountyTask Nigeria"
                  value={settings.bank_transfer_name}
                  onChange={(e) => setSettings((s) => ({ ...s, bank_transfer_name: e.target.value }))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phone Verification Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Phone Verification
          </CardTitle>
          <CardDescription>
            When enabled, users must verify a phone number via SMS code before their first
            withdrawal. Registration itself always stays free. Requires TEXTBEE_API_KEY and
            TEXTBEE_DEVICE_ID to be set in the hosting environment.
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

      {/* Advertiser Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> Advertiser Submissions
          </CardTitle>
          <CardDescription>
            Lets outside businesses submit their own task requests via <code>/advertise</code>. Every
            submission lands here as a pending lead — nothing goes live until you approve it.
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
                <Input
                  id="adv_min_budget"
                  type="number"
                  value={Math.round(settings.advertiser_min_budget_kobo / 100)}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, advertiser_min_budget_kobo: (parseInt(e.target.value) || 0) * 100 }))
                  }
                />
                <p className="text-xs text-muted-foreground">Submissions below this budget are rejected automatically.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adv_contact_email">Contact Email</Label>
                <Input
                  id="adv_contact_email"
                  type="email"
                  placeholder="partners@bountytask.ng"
                  value={settings.advertiser_contact_email}
                  onChange={(e) => setSettings((s) => ({ ...s, advertiser_contact_email: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Shown to advertisers when submissions are closed, or for direct enquiries.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adv_requirements">Requirements</Label>
                <Textarea
                  id="adv_requirements"
                  rows={3}
                  placeholder="e.g. Tasks must be legal, safe, and verifiable..."
                  value={settings.advertiser_requirements}
                  onChange={(e) => setSettings((s) => ({ ...s, advertiser_requirements: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Displayed on the /advertise page above the form.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adv_pricing">Pricing Details</Label>
                <Textarea
                  id="adv_pricing"
                  rows={3}
                  placeholder="e.g. Flat-fee tasks vs. CPA/affiliate offers, how billing works..."
                  value={settings.advertiser_pricing_info}
                  onChange={(e) => setSettings((s) => ({ ...s, advertiser_pricing_info: e.target.value }))}
                />
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
                  <Input
                    id="adv_fee"
                    type="number"
                    value={Math.round(settings.advertiser_submission_fee_kobo / 100)}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, advertiser_submission_fee_kobo: (parseInt(e.target.value) || 0) * 100 }))
                    }
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* In-App Display Ads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4" /> Display Ads
          </CardTitle>
          <CardDescription>
            Paste an ad network snippet (e.g. AdMaven, PropellerAds, AdSense) to run banner ads on
            worker-facing pages. Leave a field blank to skip that placement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable display ads</p>
              <p className="text-xs text-muted-foreground">Toggle all ad placements on or off</p>
            </div>
            <Switch
              checked={settings.ads_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, ads_enabled: v }))}
            />
          </div>

          {settings.ads_enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ads_dashboard">Dashboard Placement (HTML/script snippet)</Label>
                <Textarea
                  id="ads_dashboard"
                  rows={3}
                  placeholder='<script async src="..."></script>'
                  value={settings.ads_dashboard_snippet}
                  onChange={(e) => setSettings((s) => ({ ...s, ads_dashboard_snippet: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Shown at the top of the worker dashboard.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ads_tasklist">Task List Placement (HTML/script snippet)</Label>
                <Textarea
                  id="ads_tasklist"
                  rows={3}
                  placeholder='<script async src="..."></script>'
                  value={settings.ads_tasklist_snippet}
                  onChange={(e) => setSettings((s) => ({ ...s, ads_tasklist_snippet: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Shown between the filters and grid on the Tasks page.</p>
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
