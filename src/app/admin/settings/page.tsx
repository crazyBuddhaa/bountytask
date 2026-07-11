"use client"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, Settings2, CreditCard, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Settings = {
  verification_fee_enabled: boolean
  verification_fee_amount: number
  verification_payment_method: "paystack" | "bank_transfer"
  bank_transfer_name: string
  bank_transfer_number: string
  bank_transfer_bank: string
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    verification_fee_enabled: false,
    verification_fee_amount: 50000,
    verification_payment_method: "paystack",
    bank_transfer_name: "",
    bank_transfer_number: "",
    bank_transfer_bank: "",
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
          Configure registration verification fee and payment method.
        </p>
      </div>

      {/* Verification Fee Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registration Verification Fee</CardTitle>
          <CardDescription>
            When enabled, new users must pay this fee before their account is created.
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
            How new users will pay the verification fee.
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

      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="animate-spin" /> : <Save className="w-4 h-4" />}
        Save Settings
      </Button>
    </div>
  )
}
