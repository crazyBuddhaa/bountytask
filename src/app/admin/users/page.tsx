"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, UserCog, ShieldAlert } from "lucide-react"
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
  role: string; is_active: boolean; kyc_verified: boolean
  balance: number; created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<AdminUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [role, setRole]         = useState("")
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const [editing, setEditing]   = useState<AdminUser | null>(null)
  const [saving, setSaving]     = useState(false)
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

  async function handleSave(userId: string, updates: Partial<{ role: string; is_active: boolean }>) {
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
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
              : users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "super_admin" ? "default" : u.role === "admin" ? "outline" : "secondary"}
                      className="capitalize text-[10px]">{u.role.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">{formatCurrency(u.balance)}</TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "success" : "destructive"} className="text-[10px]">
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(u)}>
                      <UserCog className="w-3.5 h-3.5" />
                    </Button>
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

      {/* Edit modal */}
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
                <Label>Account Status</Label>
                <Select defaultValue={editing.is_active ? "active" : "inactive"}
                  onValueChange={v => setEditing(prev => prev ? { ...prev, is_active: v === "active" } : prev)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Deactivated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!editing.is_active && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Deactivating will flag this user and block all activity.
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="gradient" className="flex-1" disabled={saving}
                  onClick={() => handleSave(editing.id, { role: editing.role, is_active: editing.is_active })}>
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
