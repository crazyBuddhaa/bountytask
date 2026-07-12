"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, ListTodo, ClipboardCheck,
  Banknote, Shield, FileText, BookOpen, BarChart2,
  Settings, UserCheck, LogOut, Megaphone, Handshake, Layers,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const links = [
  { href: "/admin",                       label: "Overview",              icon: LayoutDashboard },
  { href: "/admin/users",                 label: "Users",                 icon: Users           },
  { href: "/admin/tiers",                 label: "Tiers",                 icon: Layers          },
  { href: "/admin/tasks",                 label: "Tasks",                 icon: ListTodo        },
  { href: "/admin/task-submissions",      label: "Advertiser Requests",   icon: Handshake       },
  { href: "/admin/approvals",             label: "Approvals",             icon: ClipboardCheck  },
  { href: "/admin/withdrawals",           label: "Withdrawals",           icon: Banknote        },
  { href: "/admin/pending-verifications", label: "Pending Verifications", icon: UserCheck       },
  { href: "/admin/fraud",                 label: "Fraud Flags",           icon: Shield          },
  { href: "/admin/audit-logs",            label: "Audit Logs",            icon: FileText        },
  { href: "/admin/ledger",                label: "Ledger",                icon: BookOpen        },
  { href: "/admin/reports",               label: "Reports",               icon: BarChart2       },
  { href: "/admin/notifications",         label: "Notifications",         icon: Megaphone       },
  { href: "/admin/settings",             label: "Settings",              icon: Settings        },
]

export function AdminSidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/sign-in")
  }

  return (
    <aside
      className={`w-56 shrink-0 ${mobile ? "flex" : "hidden lg:flex"} flex-col bg-card border-r border-border h-screen sticky top-0`}
    >
      {/* Brand */}
      <div className="h-16 flex items-center px-5 border-b border-border">
        <div className="w-7 h-7 rounded-lg bounty-gradient mr-2.5" />
        <span className="font-bold text-sm">BountyTask</span>
        <span className="ml-2 text-[10px] font-medium bg-destructive/10 text-destructive rounded px-1.5 py-0.5">ADMIN</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-0.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <Link href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all mb-1">
          ← User Dashboard
        </Link>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-all">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  )
}
