"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Star, Banknote, Clock, CheckCircle2, XCircle, Loader2, CreditCard, ShieldAlert, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import type { WithdrawalAccount, Withdrawal } from "@/types"

interface Bank { code: string; name: string }

const WD_LIMIT = 10

const statusIcons = {
  pending:      <Clock className="w-3.5 h-3.5 text-amber-500" />,
  under_review: <Clock className="w-3.5 h-3.5 text-blue-500" />,
  approved:     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  paid:         <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  rejected:     <XCircle className="w-3.5 h-3.5 text-destructive" />,
}

export default function WithdrawalPage() {
  const router = useRouter()
  const [balance, setBalance]         = useState<number | null>(null)
  const [accounts, setAccounts]       = useState<WithdrawalAccount[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [wdPage, setWdPage]           = useState(1)
  const [wdTotal, setWdTotal]         = useState(0)
  const [banks, setBanks]             = useState<Bank[]>([])
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [feeEnabled, setFeeEnabled] = useState(false)
  const [phoneVerificationEnabled, setPhoneVerificationEnabled] = useState(false)
  const [kycVerified, setKycVerified] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showWithdrawForm, setShowWithdrawForm] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<WithdrawalAccount | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)

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

  const [minKobo, setMinKobo] = useState(500_000)
  const MIN_NGN = Math.round(minKobo / 100)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [balRes, accRes, wdRes, verRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/withdrawals/accounts"),
        fetch(`/api/withdrawals?page=${wdPage}&limit=${WD_LIMIT}`),
        fetch("/api/settings/verification"),
      ])
      if (!balRes.ok || !accRes.ok || !wdRes.ok || !verRes.ok) {
        throw new Error("Could not load withdrawal details. Please try again.")
      }
      const [bal, acc, wd, ver] = await Promise.all([balRes.json(), accRes.json(), wdRes.json(), verRes.json()])
      setBalance(bal.data?.balance ?? 0)
      setAccounts(acc.data ?? [])
      setWithdrawals(wd.data ?? [])
      setWdTotal(wd.total ?? (wd.data?.length ?? 0))
      const isFeeEnabled = !!ver.data?.fee_enabled
      const isPhoneEnabled = !!ver.data?.phone_verification_enabled
      const isKycVerified = !!bal.data?.kyc_verified
      const isPhoneVerified = !!bal.data?.phone_verified
      setFeeEnabled(isFeeEnabled)
      setPhoneVerificationEnabled(isPhoneEnabled)
      setKycVerified(isKycVerified)
      setPhoneVerified(isPhoneVerified)
      setNeedsVerification(
        (isFeeEnabled && !isKycVerified) ||
        (isPhoneEnabled && !isPhoneVerified)
      )
      if (ver.data?.min_withdrawal_kobo) setMinKobo(ver.data.min_withdrawal_kobo)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Could not load withdrawal details. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [wdPage])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    fetch("/api/bank-verification/banks")
      .then(r => r.json())
      .then(j => setBanks(j.data ?? []))
      .catch(() => { /* banks list retryable on reload */ })
  }, [])

  // Auto-resolve account name when both fields are complete
  useEffect(() => {
    if (accountNumber.length !== 10 || !bankCode) { setResolvedName(""); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setResolving(true)
      try {
        const res  = await fetch("/api/bank-verification/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode }),
          signal: controller.signal,
        })
        const json = await res.json()
        if (!controller.signal.aborted) {
          setResolvedName(res.ok ? json.data?.account_name ?? "" : "")
          if (!res.ok) toast.error(json.error ?? "Could not verify account")
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        if (!controller.signal.aborted) {
          setResolvedName("")
          toast.error("Could not verify account. Please try again.")
        }
      } finally {
        if (!controller.signal.aborted) setResolving(false)
      }
    }, 600)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [accountNumber, bankCode])

  function openWithdrawModal() {
    const defaultAcc = accounts.find(a => a.is_default) ?? accounts[0]
    if (defaultAcc) setSelectedAccountId(defaultAcc.id)
    setShowWithdrawForm(true)
  }

  async function handleAddAccount() {
    if (!resolvedName) return
    setAddingAccount(true)
    try {
      const bank = banks.find(b => b.code === bankCode)
      const res  = await fetch("/api/withdrawals/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank_code: bankCode, bank_name: bank?.name ?? "", account_number: accountNumber }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Could not add account"); return }
      toast.success("Bank account added successfully!")
      setAccounts(prev => [...prev, json.data])
      setShowAddAccount(false)
      setBankCode(""); setAccountNumber(""); setResolvedName("")
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setAddingAccount(false)
    }
  }

  async function handleDeleteAccount(id: string) {
    setDeletingAccount(true)
    try {
      const res  = await fetch(`/api/withdrawals/accounts/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? "Failed to remove account"); return }
      toast.success("Account removed")
      setAccounts(prev => prev.filter(a => a.id !== id))
      setAccountToDelete(null)
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setDeletingAccount(false)
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const res = await fetch(`/api/withdrawals/accounts/${id}`, { method: "PATCH" })
      if (!res.ok) { toast.error("Failed to set default"); return }
      setAccounts(prev => prev.map(a => ({ ...a, is_default: a.id === id })))
      toast.success("Default account updated")
    } catch {
      toast.error("Network error. Please try again.")
    }
  }

  async function handleWithdraw() {
    const kobo = Math.round(parseFloat(amount) * 100)
    if (isNaN(kobo) || kobo < MIN_NGN * 100) {
      toast.error(`Minimum withdrawal is ₦${MIN_NGN.toLocaleString()}`); return
    }
    if (balance !== null && kobo > balance) {
      toast.error("Amount exceeds your available balance"); return
    }
    if (!selectedAccountId) { toast.error("Select a bank account"); return }
    setSubmittingWithdrawal(true)
    try {
      const res  = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: selectedAccountId, amount: kobo }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.code === "VERIFICATION_REQUIRED" || json.code === "PHONE_VERIFICATION_REQUIRED") setNeedsVerification(true)
        toast.error(json.error ?? "Withdrawal request failed"); return
      }
      toast.success("Withdrawal request submitted! We'll process it within 1–2 business days.")
      setShowWithdrawForm(false)
      setAmount(""); setSelectedAccountId("")
      if (wdPage !== 1) setWdPage(1)
      else fetchAll()
      router.refresh()
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSubmittingWithdrawal(false)
    }
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
          {needsVerification ? (
            <Button variant="gradient" size="sm" asChild>
              <Link href="/dashboard/verify"><ShieldAlert className="w-4 h-4" /> Verify to Withdraw</Link>
            </Button>
          ) : (
            <Button variant="gradient" size="sm" onClick={openWithdrawModal} disabled={accounts.length === 0}>
              <Banknote className="w-4 h-4" /> Withdraw
            </Button>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 text-destructive px-4 py-3 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} className="shrink-0 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {needsVerification && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-4 py-3 flex items-start gap-3 text-sm">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">One-time verification required before you can withdraw</p>
            <p className="text-xs mt-0.5">
              <Link href="/dashboard/verify" className="underline font-medium">Verify now</Link> — it only takes a minute.
            </p>
          </div>
        </div>
      )}

      {/* Withdrawal Readiness checklist pill row */}
      {!loading && (() => {
        const balanceReady = (balance ?? 0) >= minKobo
        const bankReady = accounts.length > 0
        const pills: { label: string; ready: boolean; href?: string; onClick?: () => void }[] = [
          {
            label: `Balance ≥ ₦${MIN_NGN.toLocaleString()}`,
            ready: balanceReady,
            href: balanceReady ? undefined : "/dashboard/tasks",
          },
          {
            label: bankReady ? "Bank account linked" : "Link bank account",
            ready: bankReady,
            onClick: bankReady ? undefined : () => setShowAddAccount(true),
          },
          ...(phoneVerificationEnabled
            ? [{
                label: phoneVerified ? "Phone verified" : "Verify phone",
                ready: phoneVerified,
                href: phoneVerified ? undefined : "/dashboard/verify",
              }]
            : []),
          ...(feeEnabled
            ? [{
                label: kycVerified ? "Account verified" : "Verify account",
                ready: kycVerified,
                href: kycVerified ? undefined : "/dashboard/verify",
              }]
            : []),
        ]
        return (
          <div className="flex flex-wrap items-center gap-2">
            {pills.map((pill) => {
              const cls = `inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border tabular-nums transition-colors ${
                pill.ready
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15"
              }`
              const content = (
                <>
                  {pill.ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {pill.label}
                </>
              )
              if (pill.href) {
                return <Link key={pill.label} href={pill.href} className={cls}>{content}</Link>
              }
              if (pill.onClick) {
                return <button key={pill.label} type="button" onClick={pill.onClick} className={cls}>{content}</button>
              }
              return <span key={pill.label} className={cls}>{content}</span>
            })}
          </div>
        )
      })()}

      {/* Balance card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Available to Withdraw</p>
            {loading ? <Skeleton className="h-10 w-36" /> : (
              <p className="text-4xl font-bold text-primary tabular-nums">{formatCurrency(balance ?? 0)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">Minimum: ₦{MIN_NGN.toLocaleString()}</p>
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
                    <p className="text-xs text-muted-foreground tabular-nums">{acc.bank_name} · ****{acc.account_number.slice(-4)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {acc.is_default
                      ? <Badge variant="success" className="text-[10px]"><Star className="w-2.5 h-2.5" />Default</Badge>
                      : <Button variant="ghost" size="sm" onClick={() => handleSetDefault(acc.id)} className="text-xs h-7">Set default</Button>
                    }
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete bank account"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setAccountToDelete(acc)}
                    >
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
            <>
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
                      <TableCell className="font-bold tabular-nums">{formatCurrency(w.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {(w as Withdrawal & { account?: { bank_name: string; account_number: string } }).account?.bank_name} ····{(w as Withdrawal & { account?: { account_number: string } }).account?.account_number?.slice(-4)}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-xs font-medium capitalize">
                          {statusIcons[w.status as keyof typeof statusIcons]}
                          {w.status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        {formatDateTime(w.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {wdTotal > WD_LIMIT && (
                <div className="flex items-center justify-center gap-2 p-4 border-t">
                  <Button variant="outline" size="sm" disabled={wdPage === 1} onClick={() => setWdPage(p => p - 1)}>
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground px-2 tabular-nums">
                    Page {wdPage} of {Math.ceil(wdTotal / WD_LIMIT)}
                  </span>
                  <Button variant="outline" size="sm" disabled={wdPage * WD_LIMIT >= wdTotal} onClick={() => setWdPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete account confirmation dialog */}
      <Dialog open={!!accountToDelete} onOpenChange={open => { if (!open) setAccountToDelete(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Bank Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {accountToDelete?.bank_name} · ****{accountToDelete?.account_number.slice(-4)}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setAccountToDelete(null)} disabled={deletingAccount} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => accountToDelete && handleDeleteAccount(accountToDelete.id)}
              disabled={deletingAccount}
              className="flex-1"
            >
              {deletingAccount && <Loader2 className="animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Input className="mt-1 tabular-nums" placeholder="10-digit account number" maxLength={10}
                value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))} />
            </div>
            {(resolving || resolvedName) && (
              <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${resolvedName ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
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
              Available balance: <span className="font-bold text-primary tabular-nums">{formatCurrency(balance ?? 0)}</span>
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
              <Input className="mt-1 tabular-nums" type="number" placeholder={`Min ₦${MIN_NGN.toLocaleString()}`}
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
