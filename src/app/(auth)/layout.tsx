import Link from "next/link"
import { Zap } from "lucide-react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — Brand Panel */}
      <div className="hidden lg:flex flex-col bounty-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <div className="relative z-10 flex flex-col h-full p-12">
          <Link href="/" className="flex items-center gap-2 text-white">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">BountyTask</span>
          </Link>

          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Complete tasks.<br />Earn Naira.
            </h1>
            <p className="text-white/80 text-lg max-w-sm">
              Nigeria&apos;s #1 task-to-earn platform. Withdraw earnings directly to your bank account.
            </p>

            <div className="mt-12 space-y-4">
              {[
                { label: "Total Users", value: "50,000+" },
                { label: "Tasks Completed", value: "2.4M+" },
                { label: "Total Paid Out", value: "₦180M+" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-white/60" />
                  <span className="text-white/70 text-sm">{stat.label}</span>
                  <span className="text-white font-semibold ml-auto">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/40 text-xs">
            &copy; {new Date().getFullYear()} BountyTask. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right — Form Panel */}
      <div className="flex flex-col items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bounty-gradient flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bounty-text-gradient">BountyTask</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
