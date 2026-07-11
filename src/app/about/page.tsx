import Link from "next/link"
import { ArrowRight, Target, Heart, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"

export const metadata = { title: "About — BountyTask", description: "Learn about BountyTask and our mission to help Nigerians earn online." }

const values = [
  { icon: Target,  title: "Fair & Transparent",  desc: "Every task reward is fixed and visible upfront. No hidden cuts, no bait-and-switch. What you see is exactly what you earn." },
  { icon: Heart,   title: "Built for Nigerians",  desc: "Withdrawals go directly to Nigerian bank accounts. No dollar accounts, no crypto wallets — just straightforward Naira payouts." },
  { icon: Shield,  title: "Fraud-Free Platform",  desc: "We use device fingerprinting, rate limiting, and manual review to ensure every task is completed honestly. Legitimate earners always win." },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 px-4 text-center border-b border-border bg-muted/20">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-5">
              About <span className="bounty-text-gradient">BountyTask</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We believe every Nigerian with a smartphone should have a legitimate, reliable way to earn extra income online — without scams, without complicated setups, and without waiting months to see their money.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                BountyTask was founded to bridge the gap between businesses that need genuine online engagement and everyday Nigerians looking for flexible income opportunities.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Businesses pay for real tasks — social media follows, app reviews, content views. Users complete those tasks and earn Naira, paid directly to their bank accounts.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Simple, transparent, and built to last.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "50,000+", label: "Active Earners"       },
                { value: "₦5M+",    label: "Paid Out Monthly"     },
                { value: "200+",    label: "Live Tasks"            },
                { value: "2024",    label: "Founded"               },
              ].map(({ value, label }) => (
                <div key={label} className="p-5 rounded-2xl border border-border bg-card text-center">
                  <p className="text-2xl font-bold bounty-text-gradient">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 px-4 bg-muted/20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">Our Values</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {values.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-6 rounded-2xl border border-border bg-card text-center">
                  <div className="w-12 h-12 rounded-full bounty-gradient flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 text-center">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-3">Ready to join the community?</h2>
            <p className="text-muted-foreground mb-6">Start earning today with a ₦200 welcome bonus.</p>
            <Button size="lg" variant="gradient" asChild>
              <Link href="/register">Get Started Free <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
