"use client"
import { useState, useEffect, useCallback } from "react"
import { Search, UserCog, ShieldAlert, UserX, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { formatCurrency, formatDate } from "@/lib/utils"

interface AdminUser {
  id: string; full_name: string; email: string; username: string | null
  role: string; is_active: boolean; kyc_verified: boolean; tier: number
  balance: number; created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers]             = useState<AdminUser[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [role, setRole]               = useState("")
  const [page, setPage]               = useState(1)
  const [total, setTotal]             = useState(0)
  const [editing, setEditing]         = useState<AdminUser | null>(null)
  const [saving, setSaving]           = useState(false)
  // Soft-delete confirmation
  const [confirmUser, setConfirmUser] = useState<AdminUser | null>(null)
  const [confirming, setConfirming]   = useState(false)
  const limit = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set("search", search)
    if (role && role !== "all") params.set("role", role)
    const res  = await fetch(`/api/admin/users?${params}`)
    const json = await res.json()
    setUsers(json.data ?? [])
    setTotal(json.total ?? 0)
    setLoading(false)
  }, [page, search, role])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleSave(userId: string, updates: Partial<{ role: string; is_active: boolean; tier: number }>) {
    setSaving(true)
    const res  = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error); setSaving(false); return }
    toast.success("User updated")
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u))
    setEditing(null)
    setSaving(false)
  }

  async function handleToggleActive(user: AdminUser, activate: boolean) {
    setConfirming(true)
    const res  = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: activate }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error)
      setConfirming(false)
      return
    }
    toast.success(activate ? "User reactivated" : "User deactivated")
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: activate } : u))
    setConfirmUser(null)
    setConfirming(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">{total.toLocaleString()} accounts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, email, username…" className="pl-9"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select value={role} onValueChange={v => { setRole(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
              : users.map(u => (
                <TableRow key={u.id} className={!u.is_active ? "opacity-60" : ""}>
                  <TableCell>
                    <p className="font-medium text-sm">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "super_admin" ? "default" : u.role === "admin" ? "outline" : "secondary"}
                      className="capitalize text-[10px]">{u.role.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">Tier {u.tier}</Badge></TableCell>
                  <TableCell className="font-medium tabular-nums">{formatCurrency(u.balance)}</TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "success" : "destructive"} className="text-[10px]">
                      {u.is_active ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* Edit role / tier */}
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit user"
                        onClick={() => setEditing(u)}>
                        <UserCog className="w-3.5 h-3.5" />
                      </Button>
                      {/* Soft delete / reactivate */}
                      {u.is_active ? (
                        <Button variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Deactivate account"
                          onClick={() => setConfirmUser(u)}>
                          <UserX className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          title="Reactivate account"
                          onClick={() => setConfirmUser(u)}>
                          <UserCheck className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">Page {page} of {Math.ceil(total / limit)}</span>
          <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* Edit modal — role, tier only */}
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit User: {editing.full_name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Role</Label>
                <Select defaultValue={editing.role}
                  onValueChange={v => setEditing(prev => prev ? { ...prev, role: v } : prev)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tier (manual override)</Label>
                <Select defaultValue={String(editing.tier)}
                  onValueChange={v => setEditing(prev => prev ? { ...prev, tier: parseInt(v) } : prev)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(t => <SelectItem key={t} value={String(t)}>Tier {t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Tiers normally rise automatically from referrals. A manual raise here is never
                  reverted, but future referral activity can still raise it further.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="gradient" className="flex-1" disabled={saving}
                  onClick={() => handleSave(editing.id, { role: editing.role, tier: editing.tier })}>
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Deactivate / Reactivate confirmation dialog */}
      {confirmUser && (
        <Dialog open onOpenChange={() => { if (!confirming) setConfirmUser(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {confirmUser.is_active ? "Deactivate account?" : "Reactivate account?"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {confirmUser.is_active ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> This is a soft delete
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{confirmUser.full_name}</span> ({confirmUser.email}) will be
                    blocked from logging in and completing tasks. Their balance, earnings history,
                    and all data are preserved. You can reactivate them at any time.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    To permanently erase this account, use the Supabase dashboard.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm text-emerald-800">
                    <span className="font-medium">{confirmUser.full_name}</span> ({confirmUser.email}) will
                    regain full access to their account.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" disabled={confirming}
                  onClick={() => setConfirmUser(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  variant={confirmUser.is_active ? "destructive" : "default"}
                  disabled={confirming}
                  onClick={() => handleToggleActive(confirmUser, !confirmUser.is_active)}>
                  {confirming
                    ? "Saving…"
                    : confirmUser.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
