"use client"
import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Star, Banknote, Clock, CheckCircle2, XCircle, Loader2, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import type { WithdrawalAccount, Withdrawal } from "@/types"

interface Bank { code: string; name: string }

const statusIcons = {
  pending:      <Clock className="w-3.5 h-3.5 text-amber-500" />,
  under_review: <Clock className="w-3.5 h-3.5 text-blue-500" />,
  approved:     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  paid:         <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  rejected:     <XCircle className="w-3.5 h-3.5 text-destructive" />,
}

export default function WithdrawalPage() {
  const [balance, setBalance]         = useState<number | null>(null)
  const [accounts, setAccounts]       = useState<WithdrawalAccount[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [banks, setBanks]             = useState<Bank[]>([])
  const [loading, setLoading]         = useState(true)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showWithdrawForm, setShowWithdrawForm] = useState(false)

  // Add-account form
  const [bankCode, setBankCode]         = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [resolvedName, setResolvedName] = useState("")
  const [resolving, setResolving]       = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)

  // Withdraw form
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [amount, setAmount]             = useState("")
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false)

  const MIN_NGN = 5000

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [balRes, accRes, wdRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/withdrawals/accounts"),
      fetch("/api/withdrawals?limit=10"),
    ])
    const [bal, acc, wd] = await Promise.all([balRes.json(), accRes.json(), wdRes.json()])
    setBalance(bal.data?.balance ?? 0)
    setAccounts(acc.data ?? [])
    setWithdrawals(wd.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    fetch("/api/paystack/banks")
      .then(r => r.json())
      .then(j => setBanks(j.data ?? []))
  }, [])

  // Auto-resolve account name when both fields are complete
  useEffect(() => {
    if (accountNumber.length !== 10 || !bankCode) { setResolvedName(""); return }
    let cancelled = false
    const timer = setTimeout(async () => {
      setResolving(true)
      const res  = await fetch("/api/paystack/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode }),
      })
      const json = await res.json()
      if (!cancelled) {
        setResolvedName(res.ok ? json.data?.account_name ?? "" : "")
        if (!res.ok) toast.error(json.error ?? "Could not verify account")
        setResolving(false)
      }
    }, 600)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [accountNumber, bankCode])

  async function handleAddAccount() {
    if (!resolvedName) return
    setAddingAccount(true)
    const bank = banks.find(b => b.code === bankCode)
    const res  = await fetch("/api/withdrawals/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_code: bankCode, bank_name: bank?.name ?? "", account_number: accountNumber }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setAddingAccount(false); return }
    toast.success("Bank account added successfully!")
    setAccounts(prev => [...prev, json.data])
    setShowAddAccount(false)
    setBankCode(""); setAccountNumber(""); setResolvedName("")
    setAddingAccount(false)
  }

  async function handleDeleteAccount(id: string) {
    const res  = await fetch(`/api/withdrawals/accounts/${id}`, { method: "DELETE" })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); return }
    toast.success("Account removed")
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  async function handleSetDefault(id: string) {
    const res = await fetch(`/api/withdrawals/accounts/${id}`, { method: "PATCH" })
    if (!res.ok) { toast.error("Failed to set default"); return }
    setAccounts(prev => prev.map(a => ({ ...a, is_default: a.id === id })))
    toast.success("Default account updated")
  }

  async function handleWithdraw() {
    const kobo = Math.round(parseFloat(amount) * 100)
    if (isNaN(kobo) || kobo < MIN_NGN * 100) {
      toast.error(`Minimum withdrawal is ₦${MIN_NGN.toLocaleString()}`); return
    }
    if (!selectedAccountId) { toast.error("Select a bank account"); return }
    setSubmittingWithdrawal(true)
    const res  = await fetch("/api/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: selectedAccountId, amount: kobo }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setSubmittingWithdrawal(false); return }
    toast.success("Withdrawal request submitted! We'll process it within 1–2 business days.")
    setShowWithdrawForm(false)
    setAmount(""); setSelectedAccountId("")
    fetchAll()
    setSubmittingWithdrawal(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Withdrawals</h1>
          <p className="text-muted-foreground text-sm mt-1">Transfer your earnings to your Nigerian bank account.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddAccount(true)}>
            <Plus className="w-4 h-4" /> Add Account
          </Button>
          <Button variant="gradient" size="sm" onClick={() => setShowWithdrawForm(true)} disabled={accounts.length === 0}>
            <Banknote className="w-4 h-4" /> Withdraw
          </Button>
        </div>
      </div>

      {/* Balance card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Available to Withdraw</p>
            {loading ? <Skeleton className="h-10 w-36" /> : (
              <p className="text-4xl font-bold text-primary">{formatCurrency(balance ?? 0)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Minimum: ₦{MIN_NGN.toLocaleString()}</p>
          </div>
          <Banknote className="w-12 h-12 text-primary/30" />
        </CardContent>
      </Card>

      {/* Bank accounts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Saved Bank Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No bank accounts added yet.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAddAccount(true)}>
                <Plus className="w-4 h-4" /> Add your first account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => (
                <div key={acc.id} className={`flex items-center justify-between p-4 rounded-lg border ${acc.is_default ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                  <div>
                    <p className="font-medium text-sm">{acc.account_name}</p>
                    <p className="text-xs text-muted-foreground">{acc.bank_name} · ****{acc.account_number.slice(-4)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {acc.is_default
                      ? <Badge variant="success" className="text-[10px]"><Star className="w-2.5 h-2.5" />Default</Badge>
                      : <Button variant="ghost" size="sm" onClick={() => handleSetDefault(acc.id)} className="text-xs h-7">Set default</Button>
                    }
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteAccount(acc.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Withdrawal History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No withdrawals yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="font-bold">{formatCurrency(w.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(w as Withdrawal & { account?: { bank_name: string; account_number: string } }).account?.bank_name} ····{(w as Withdrawal & { account?: { account_number: string } }).account?.account_number?.slice(-4)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs font-medium capitalize">
                        {statusIcons[w.status as keyof typeof statusIcons]}
                        {w.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(w.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add account modal */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bank Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bank</Label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select your bank" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {banks.map(b => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account Number</Label>
              <Input className="mt-1" placeholder="10-digit account number" maxLength={10}
                value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))} />
            </div>
            {(resolving || resolvedName) && (
              <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${resolvedName ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {resolving ? "Verifying account..." : resolvedName}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAddAccount(false)} className="flex-1">Cancel</Button>
              <Button variant="gradient" onClick={handleAddAccount} disabled={!resolvedName || addingAccount} className="flex-1">
                {addingAccount && <Loader2 className="animate-spin" />}
                Add Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw modal */}
      <Dialog open={showWithdrawForm} onOpenChange={setShowWithdrawForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted text-sm">
              Available balance: <span className="font-bold text-primary">{formatCurrency(balance ?? 0)}</span>
            </div>
            <div>
              <Label>Bank Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.bank_name} — {a.account_name} ****{a.account_number.slice(-4)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₦)</Label>
              <Input className="mt-1" type="number" placeholder={`Min ₦${MIN_NGN.toLocaleString()}`}
                min={MIN_NGN} value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Withdrawals are processed manually within 1–2 business days. A ledger debit is created immediately to reserve the funds.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowWithdrawForm(false)} className="flex-1">Cancel</Button>
              <Button variant="gradient" onClick={handleWithdraw} disabled={submittingWithdrawal} className="flex-1">
                {submittingWithdrawal && <Loader2 className="animate-spin" />}
                Request Withdrawal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
