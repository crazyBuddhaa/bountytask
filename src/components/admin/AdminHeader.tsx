"use client"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { AdminSidebar } from "./AdminSidebar"

/**
 * Mobile-only top bar for the admin section. AdminSidebar is
 * `hidden lg:flex` on its own, so below the lg breakpoint this is the
 * only way to reach any admin page besides Overview.
 */
export function AdminHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 h-14 px-4 border-b bg-background/95 backdrop-blur-sm lg:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          <AdminSidebar mobile />
        </SheetContent>
      </Sheet>

      <div className="w-6 h-6 rounded-lg bounty-gradient" />
      <span className="font-bold text-sm">BountyTask</span>
      <span className="text-[10px] font-medium bg-destructive/10 text-destructive rounded px-1.5 py-0.5">ADMIN</span>
    </header>
  )
}
