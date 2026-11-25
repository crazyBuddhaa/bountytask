"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, LogOut, User, Settings, Menu, Award } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { DashboardSidebar } from "./DashboardSidebar"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { getInitials, formatCurrency } from "@/lib/utils"
import type { UserProfile, Tier } from "@/types"

interface DashboardHeaderProps {
  user: UserProfile
  balance: number
  unreadCount?: number
  currentTier?: Tier | null
}

function tierBadgeClass(name?: string | null) {
  switch (name?.toLowerCase()) {
    case "bronze":   return "bg-amber-100 text-amber-800 border-amber-200"
    case "silver":   return "bg-slate-100 text-slate-700 border-slate-200"
    case "gold":     return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "platinum": return "bg-cyan-100 text-cyan-800 border-cyan-200"
    case "diamond":  return "bg-blue-100 text-blue-800 border-blue-200"
    case "elite":    return "bg-purple-100 text-purple-800 border-purple-200"
    default:         return "bg-muted text-muted-foreground border-border"
  }
}

export function DashboardHeader({ user, balance, unreadCount = 0, currentTier }: DashboardHeaderProps) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Signed out")
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-2 sm:gap-4 px-4 lg:px-6">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <DashboardSidebar mobile onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Mobile logo */}
        <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
          <Image src="/logo.png" alt="BountyTask" width={28} height={28} className="rounded-lg" />
          <span className="font-bold bounty-text-gradient hidden xs:inline sm:inline">BountyTask</span>
        </Link>

        <div className="flex-1" />

        {/* Tier badge */}
        {currentTier && (
          <Link href="/dashboard/referral">
            <div className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border ${tierBadgeClass(currentTier.name)}`}>
              <Award className="w-3.5 h-3.5" />
              {currentTier.name}
            </div>
          </Link>
        )}

        {/* Balance pill */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-primary/10 text-primary rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5">
          <span className="hidden sm:inline text-xs font-medium opacity-70">Balance</span>
          <span className="text-xs sm:text-sm font-bold tabular-nums">{formatCurrency(balance)}</span>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link
            href="/dashboard/notifications"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bounty-gradient rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" aria-label="Account menu">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar_url ?? ""} alt={user.full_name ?? "User"} />
                <AvatarFallback className="bounty-gradient text-white text-xs font-bold">
                  {getInitials(user.full_name ?? user.email)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium truncate">{user.full_name ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile"><User className="w-4 h-4" />Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/security"><Settings className="w-4 h-4" />Security</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4" />Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
