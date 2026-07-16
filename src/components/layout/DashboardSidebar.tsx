"use client"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ListTodo, CheckSquare, TrendingUp,
  Banknote, Users, Bell, User, Shield,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/tasks", label: "Available Tasks", icon: ListTodo },
  { href: "/dashboard/my-tasks", label: "My Tasks", icon: CheckSquare },
  { href: "/dashboard/earnings", label: "Earnings", icon: TrendingUp },
  { href: "/dashboard/withdrawal", label: "Withdrawal", icon: Banknote },
  { href: "/dashboard/referral", label: "Referral", icon: Users },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/security", label: "Security", icon: Shield },
]

interface DashboardSidebarProps {
  /** When true, renders as a plain flex column (for use inside a mobile Sheet). */
  mobile?: boolean
}

export function DashboardSidebar({ mobile = false }: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "w-64 flex-col border-r bg-card min-h-screen",
        mobile ? "flex" : "hidden lg:flex"
      )}
    >
      <div className="p-6 border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.png" alt="BountyTask" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-lg bounty-text-gradient">BountyTask</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", active && "text-primary")} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="rounded-xl bounty-gradient p-4 text-white">
          <p className="text-xs font-medium opacity-80">Refer & Earn</p>
          <p className="text-sm font-semibold mt-1">Get ₦500 per referral</p>
          <Link
            href="/dashboard/referral"
            className="mt-2 inline-block text-xs underline opacity-90 hover:opacity-100"
          >
            Share your link →
          </Link>
        </div>
      </div>
    </aside>
  )
}
