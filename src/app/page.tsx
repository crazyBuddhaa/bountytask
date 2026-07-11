import Link from "next/link"
import { ArrowRight, Zap, Shield, Banknote, Users, Star, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"

const features = [
  {
    icon: Zap,
    title: "Instant Payouts",
    desc: "Unverified tasks pay immediately to your in-app wallet — no waiting, no delays.",
  },
  {
    icon: Shield,
    title: "Fraud-Protected",
    desc: "Device fingerprinting, rate limits, and manual review keep the platform fair for everyone.",
  },
  {
    icon: Banknote,
    title: "Nigerian Bank Withdrawal",
    desc: "Withdraw directly to any Nigerian bank account. Verified via Paystack, paid manually within 48hrs.",
  },
  {
    icon: Users,
    title: "Referral Bonuses",
    desc: "Earn ₦500 for every friend you refer. Your friend gets ₦200 just for signing up.",
  },
]

const taskExamples = [
  { title: "Follow and like our Instagram post",  reward: "₦200",  type: "Instant", category: "Social Media" },
  { title: "Leave a 5-star review on Google Maps", reward: "₦500", type: "Verified", category: "Reviews"     },
  { title: "Sign up for our newsletter",           reward: "₦150", type: "Instant", category: "Email"        },
  { title: "Watch a YouTube video for 5 minutes",  reward: "₦300", type: "Instant", category: "Content"      },
  { title: "Download and rate our mobile app",     reward: "₦600", type: "Verified", category: "App Store"   },
  { title: "Share our post on WhatsApp",           reward: "₦250", type: "Instant", category: "Social Media" },
]

const steps = [
  { n: "01", title: "Create free account",  desc: "Sign up in 60 seconds with your email. Receive ₦200 as a welcome bonus instantly."   },
  { n: "02", title: "Pick a task",          desc: "Browse the marketplace and claim tasks that match your skills and available time."     },
  { n: "03", title: "Complete & submit",    desc: "Follow the instructions, submit proof if required, and get credited automatically."   },
  { n: "04", title: "Withdraw to your bank",desc: "Once your balance hits ₦5,000, request a transfer to any Nigerian bank account."     },
]

const testimonials = [
  { name: "Chioma A.", location: "Lagos",    text: "I earned ₦12,000 in my first week. The tasks are simple and the payouts are real.", stars: 5 },
  { name: "Emeka O.",  location: "Abuja",    text: "Best legitimate money-making platform I've found in Nigeria. Already referred 8 friends!", stars: 5 },
  { name: "Fatima M.", location: "Kano",     text: "Withdrew ₦30,000 this month. It's become part of my daily routine.", stars: 5 },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28 px-4 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto relative">
          <Badge variant="outline" className="mb-6 text-xs font-medium px-3 py-1 rounded-full border-primary/30 text-primary bg-primary/5">
            🇳🇬 Nigeria&apos;s #1 Task-to-Earn Platform
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
            Complete Tasks.<br />
            <span className="bounty-text-gradient">Earn Real Naira.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            BountyTask connects everyday Nigerians with businesses that need reviews, followers, and engagement.
            Complete simple tasks and withdraw directly to your Nigerian bank account.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" variant="gradient" className="text-base px-8" asChild>
              <Link href="/register">
                Start Earning Free <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base" asChild>
              <Link href="#how-it-works">How it works</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            ₦200 signup bonus · No card required · Withdraw in 48hrs
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-muted/30 py-8">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: "50,000+", label: "Active Earners"       },
            { value: "₦5M+",    label: "Paid Out Monthly"     },
            { value: "200+",    label: "Available Tasks"       },
            { value: "48hrs",   label: "Avg. Withdrawal Time"  },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl sm:text-3xl font-extrabold bounty-text-gradient">{value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">How BountyTask Works</h2>
            <p className="text-muted-foreground">Four simple steps from signup to your first withdrawal.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(({ n, title, desc }) => (
              <div key={n} className="relative text-center p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors">
                <div className="w-12 h-12 rounded-full bounty-gradient flex items-center justify-center text-white font-bold text-lg mx-auto mb-4 shadow-md">
                  {n}
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Why Choose BountyTask?</h2>
            <p className="text-muted-foreground">Built for Nigerians, by Nigerians. Real money, real fast.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-6 rounded-2xl border border-border bg-card">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample tasks */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Sample Tasks Available Today</h2>
            <p className="text-muted-foreground">Browse hundreds of tasks across multiple categories.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {taskExamples.map(({ title, reward, type, category }) => (
              <div key={title}
                className="p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{category}</span>
                  <Badge variant={type === "Instant" ? "success" : "pending"} className="text-[10px]">
                    {type === "Instant" ? <Zap className="w-2.5 h-2.5" /> : null}
                    {type}
                  </Badge>
                </div>
                <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors mb-3">{title}</p>
                <p className="text-xl font-bold text-primary">{reward}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button variant="gradient" size="lg" asChild>
              <Link href="/register">See All Tasks <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">What Earners Are Saying</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map(({ name, location, text, stars }) => (
              <div key={name} className="p-6 rounded-2xl border border-border bg-card">
                <div className="flex mb-3">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">&ldquo;{text}&rdquo;</p>
                <div>
                  <p className="font-semibold text-sm">{name}</p>
                  <p className="text-xs text-muted-foreground">{location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-10 rounded-3xl bounty-gradient text-white shadow-xl">
            <h2 className="text-3xl font-extrabold mb-3">Ready to Start Earning?</h2>
            <p className="text-white/80 mb-6 text-lg">
              Join 50,000+ Nigerians already earning on BountyTask. Your ₦200 welcome bonus is waiting.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" variant="secondary" className="font-bold text-primary" asChild>
                <Link href="/register">
                  Create Free Account <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" className="text-white border border-white/30 hover:bg-white/10" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
            </div>
            <div className="flex justify-center gap-6 mt-6 text-sm text-white/70">
              {["₦200 signup bonus", "No card required", "Withdraw in 48hrs"].map(t => (
                <span key={t} className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />{t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
