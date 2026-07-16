import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getLiveBalance } from "@/lib/ledger"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserTierStatus } from "@/lib/tiers"
import { DashboardSidebar } from "@/components/layout/DashboardSidebar"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import type { UserProfile } from "@/types"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in")

  const admin = createAdminClient()

  const [profileResult, balance, notifResult, tierStatus] = await Promise.all([
    admin.from("users").select("*").eq("id", user.id).single(),
    getLiveBalance(user.id),
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false),
    getUserTierStatus(user.id),
  ])

  if (!profileResult.data) redirect("/sign-in")

  const profile = profileResult.data as UserProfile
  const unreadCount = notifResult.count ?? 0

  return (
    <div className="flex min-h-screen bg-muted/30">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={profile} balance={balance} unreadCount={unreadCount} currentTier={tierStatus.currentTier} />
        <main className="flex-1 p-4 lg:p-6 animate-fade-in space-y-4">
          {children}
        </main>
      </div>
    </div>
  )
}
