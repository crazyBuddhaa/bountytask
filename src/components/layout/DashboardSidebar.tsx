"use client"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ListTodo, CheckSquare, TrendingUp,
  Banknote, Users, Bell, User, Shield, Gamepad2, Newspaper, HelpCircle,
} from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: "Earn",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/tasks", label: "Available Tasks", icon: ListTodo },
      { href: "/dashboard/games", label: "Games & Earn", icon: Gamepad2 },
      { href: "/dashboard/news", label: "News", icon: Newspaper },
    ],
  },
  {
    title: "Wallet",
    items: [
      { href: "/dashboard/earnings", label: "Earnings", icon: TrendingUp },
      { href: "/dashboard/withdrawal", label: "Withdrawal", icon: Banknote },
      { href: "/dashboard/referral", label: "Referral", icon: Users },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/dashboard/my-tasks", label: "My Tasks", icon: CheckSquare },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/dashboard/profile", label: "Profile", icon: User },
      { href: "/dashboard/security", label: "Security", icon: Shield },
      { href: "/learn#how-it-works", label: "How it works", icon: HelpCircle },
    ],
  },
]

interface DashboardSidebarProps {
  /** When true, renders as a plain flex column (for use inside a mobile Sheet). */
  mobile?: boolean
  /** Optional callback invoked when a navigation link is clicked (e.g. to close a mobile Sheet). */
  onNavigate?: () => void
}

export function DashboardSidebar({ mobile = false, onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "w-64 flex-col border-r bg-card",
        mobile ? "flex h-full overflow-y-auto" : "hidden lg:flex min-h-screen"
      )}
      // Stop clicks inside the sidebar from bubbling to the document.
      // Monetag OnClick popunder attaches a document-level bubble-phase
      // listener; intercepting here means navigating between dashboard pages
      // via the sidebar never triggers a pop-under or interstitial ad.
      // Next.js <Link> handles navigation at the component level before
      // bubbling, so routing is completely unaffected.
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-6 border-b">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
          <Image src="/logo.png" alt="BountyTask" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-lg bounty-text-gradient">BountyTask</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 mb-1.5">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
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
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t">
        <div className="rounded-xl bounty-gradient p-4 text-white">
          <p className="text-xs font-medium opacity-80">Refer & Earn</p>
          <p className="text-sm font-semibold mt-1">Get ₦500 per referral</p>
          <Link
            href="/dashboard/referral"
            onClick={onNavigate}
            className="mt-2 inline-block text-xs underline opacity-90 hover:opacity-100"
          >
            Share your link →
          </Link>
        </div>
      </div>
    </aside>
  )
}
