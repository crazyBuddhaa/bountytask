import Link from "next/link"
import {
  ArrowRight,
  Zap,
  Shield,
  Banknote,
  Users,
  Target,
  Heart,
  CheckCircle2,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"

export const metadata = {
  title: "How It Works, About & FAQ — BountyTask",
  description:
    "Learn how BountyTask works, who we are, and get answers to the most common questions about earning Naira on our platform.",
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const steps = [
  {
    n: "01",
    title: "Create a free account",
    desc: "Sign up in 60 seconds with your email. Receive ₦200 as a welcome bonus the moment you confirm your email — no card required.",
  },
  {
    n: "02",
    title: "Browse & claim tasks",
    desc: "Explore hundreds of tasks across Social Media, Reviews, Content, and more. Filter by category, reward size, or task type to find what fits you.",
  },
  {
    n: "03",
    title: "Complete & submit proof",
    desc: "Follow the step-by-step instructions. Some tasks credit you instantly; others go to a quick admin review. Either way, you always see the status.",
  },
  {
    n: "04",
    title: "Withdraw to your bank",
    desc: "Once your balance hits ₦5,000, request a transfer to any Nigerian bank account. Verified via Paystack and paid within 48 hours.",
  },
]

const taskTypes = [
  {
    icon: Zap,
    title: "Instant Tasks",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    desc: "Credits land in your wallet the second you submit — no waiting, no review. Perfect for social follows, newsletter sign-ups, and simple online actions.",
  },
  {
    icon: Shield,
    title: "Verified Tasks",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    desc: "Require a screenshot or proof of completion. Our team reviews within 24–48 hours. Higher rewards reflect the extra effort.",
  },
  {
    icon: Banknote,
    title: "Survey & Offer Walls",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    desc: "Complete short surveys or engage with brand offers through our partner networks. Rewards are credited automatically after you finish.",
  },
  {
    icon: Users,
    title: "Social Tasks",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    desc: "Follow, like, comment, or repost on Twitter, Instagram, TikTok, YouTube, and Facebook. AI verifies your screenshot so approval is near-instant.",
  },
]

const values = [
  {
    icon: Target,
    title: "Fair & Transparent",
    desc: "Every task reward is fixed and visible upfront. No hidden cuts, no bait-and-switch. What you see is exactly what you earn.",
  },
  {
    icon: Heart,
    title: "Built for Nigerians",
    desc: "Withdrawals go directly to Nigerian bank accounts. No dollar accounts, no crypto wallets — just straightforward Naira payouts.",
  },
  {
    icon: Shield,
    title: "Fraud-Free Platform",
    desc: "We use device fingerprinting, rate limiting, and manual review to ensure every task is completed honestly. Legitimate earners always win.",
  },
]

const stats = [
  { value: "50,000+", label: "Active Earners" },
  { value: "₦5M+",   label: "Paid Out Monthly" },
  { value: "200+",   label: "Live Tasks" },
  { value: "48hrs",  label: "Avg. Withdrawal Time" },
]

const faqs = [
  {
    q: "Is BountyTask legitimate?",
    a: "Yes. BountyTask is a Nigerian task-to-earn platform that connects real businesses with real users. We pay out millions of naira every month. Every withdrawal goes directly to a verified Nigerian bank account.",
  },
  {
    q: "How quickly are tasks credited?",
    a: "Instant (unverified) tasks are credited to your wallet immediately upon submission. Verified tasks require admin review, which typically takes 24–48 hours.",
  },
  {
    q: "What is the minimum withdrawal amount?",
    a: "The minimum withdrawal is ₦5,000. This covers bank transfer fees while keeping the process sustainable for everyone.",
  },
  {
    q: "How long does a withdrawal take?",
    a: "Withdrawals are processed manually and paid within 1–2 business days of approval. You receive in-app and email notifications at every step.",
  },
  {
    q: "Is my bank account information safe?",
    a: "Yes. We use Paystack to verify your account number and name — we never store your PIN, BVN, or any sensitive banking credentials.",
  },
  {
    q: "Can I complete the same task twice?",
    a: "No. Each task can be completed once per user. Attempting duplicate submissions returns an error; repeated fraud attempts may result in account suspension.",
  },
  {
    q: "How does the referral programme work?",
    a: "Share your unique referral link. When a friend signs up and completes their first task, you earn ₦500 and they keep their ₦200 signup bonus — both are credited automatically.",
  },
  {
    q: "What happens if my task is rejected?",
    a: "You receive a notification with the reason. Because rewards for verified tasks are only credited after approval, nothing is deducted. You may re-submit once you've addressed the rejection reason.",
  },
  {
    q: "Can I use BountyTask on mobile?",
    a: "Absolutely. BountyTask is fully responsive and works on any modern smartphone browser. Chrome or Safari gives the best experience.",
  },
  {
    q: "How do I contact support?",
    a: "Use the Contact page to send us a message. We reply within 24 hours on business days.",
  },
  {
    q: "Does signing up cost anything?",
    a: "Never. Registration is always free. You even receive ₦200 just for confirming your email address.",
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LearnPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* ── Page hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 px-4 text-center border-b border-border bg-muted/20">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto relative">
          <Badge
            variant="outline"
            className="mb-6 text-xs font-medium px-3 py-1 rounded-full border-primary/30 text-primary bg-primary/5"
          >
            Everything you need to know
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4">
            How <span className="bounty-text-gradient">BountyTask</span> Works
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            From your first task to your first withdrawal — a complete guide to
            earning on Nigeria's #1 micro-task platform.
          </p>
          {/* Jump links */}
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {[
              { label: "How it works", href: "#how-it-works" },
              { label: "About us",     href: "#about"        },
              { label: "FAQ",          href: "#faq"          },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-1 px-4 py-2 rounded-full border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors font-medium"
              >
                {label} <ChevronDown className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <main className="flex-1">

        {/* ── HOW IT WORKS ──────────────────────────────────── */}
        <section id="how-it-works" className="py-20 px-4 scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-3">Four Steps to Your First Naira</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                No complicated setup. No experience needed. Just a smartphone and a few spare minutes.
              </p>
            </div>

            {/* Steps */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {steps.map(({ n, title, desc }) => (
                <div
                  key={n}
                  className="relative text-center p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bounty-gradient flex items-center justify-center text-white font-bold text-lg mx-auto mb-4 shadow-md">
                    {n}
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Task types */}
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold mb-2">Types of Tasks You&apos;ll Find</h3>
              <p className="text-muted-foreground text-sm">
                Different task types suit different schedules and skill levels.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5 mb-16">
              {taskTypes.map(({ icon: Icon, title, color, bg, desc }) => (
                <div key={title} className="flex gap-4 p-6 rounded-2xl border border-border bg-card">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mini CTA */}
            <div className="text-center p-10 rounded-3xl bounty-gradient text-white shadow-lg">
              <h3 className="text-2xl font-extrabold mb-2">Ready to start?</h3>
              <p className="text-white/80 mb-5">
                Your ₦200 welcome bonus is waiting. No card, no catch.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" variant="secondary" className="font-bold text-primary" asChild>
                  <Link href="/register">
                    Create Free Account <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white border border-white/30 hover:bg-white/10"
                  asChild
                >
                  <Link href="/sign-in">Sign In</Link>
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-5 mt-5 text-sm text-white/70">
                {["₦200 signup bonus", "No card required", "Withdraw in 48hrs"].map(t => (
                  <span key={t} className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── ABOUT ─────────────────────────────────────────── */}
        <section id="about" className="py-20 px-4 bg-muted/20 scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-3">
                About <span className="bounty-text-gradient">BountyTask</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                We believe every Nigerian with a smartphone deserves a legitimate, reliable way to earn extra income — without scams, without complicated setups.
              </p>
            </div>

            {/* Mission + Stats */}
            <div className="grid md:grid-cols-2 gap-10 items-center mb-14">
              <div>
                <h3 className="text-xl font-bold mb-4">Our Mission</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  BountyTask was founded to bridge the gap between businesses that need genuine online
                  engagement and everyday Nigerians looking for flexible income opportunities.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Businesses pay for real tasks — social media follows, app reviews, content views.
                  Users complete those tasks and earn Naira, paid directly to their bank accounts.
                </p>
                <p className="text-muted-foreground leading-relaxed font-medium">
                  Simple, transparent, and built to last.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {stats.map(({ value, label }) => (
                  <div
                    key={label}
                    className="p-5 rounded-2xl border border-border bg-card text-center"
                  >
                    <p className="text-2xl font-bold bounty-text-gradient">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Values */}
            <div>
              <h3 className="text-xl font-bold text-center mb-8">Our Values</h3>
              <div className="grid sm:grid-cols-3 gap-6">
                {values.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="p-6 rounded-2xl border border-border bg-card text-center"
                  >
                    <div className="w-12 h-12 rounded-full bounty-gradient flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold mb-2">{title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────── */}
        <section id="faq" className="py-20 px-4 scroll-mt-20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-3">Frequently Asked Questions</h2>
              <p className="text-muted-foreground">
                Everything you need to know about earning on BountyTask.
              </p>
            </div>

            <div className="space-y-4 mb-14">
              {faqs.map(({ q, a }) => (
                <div key={q} className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="font-semibold text-base mb-2">{q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </div>
              ))}
            </div>

            {/* Footer CTA */}
            <div className="text-center p-8 rounded-2xl border border-border bg-muted/30">
              <p className="font-medium mb-1">Still have questions?</p>
              <p className="text-sm text-muted-foreground mb-5">
                Our support team responds within 24 hours on business days.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="gradient" asChild>
                  <Link href="/contact">Contact Support</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/register">
                    Start Earning <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
