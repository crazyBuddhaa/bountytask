import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"
import { RecentPayoutsStrip } from "@/components/trust/RecentPayoutsStrip"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatCurrency } from "@/lib/utils"

export const revalidate = 120

interface LiveTaskPreview {
  id: string
  title: string
  reward_amount: number
  type: "verified" | "unverified"
  categoryLabel: string
  estTime: string
}

const FALLBACK_TASKS: LiveTaskPreview[] = [
  {
    id: "sample-1",
    title: "Follow a verified brand account on Instagram",
    reward_amount: 15000,
    type: "verified",
    categoryLabel: "Social",
    estTime: "~30s",
  },
  {
    id: "sample-2",
    title: "Watch a short creator video on YouTube",
    reward_amount: 20000,
    type: "unverified",
    categoryLabel: "Video",
    estTime: "~2m",
  },
  {
    id: "sample-3",
    title: "Like and leave a genuine comment on X",
    reward_amount: 10000,
    type: "verified",
    categoryLabel: "Social",
    estTime: "~45s",
  },
  {
    id: "sample-4",
    title: "Complete a partner market research survey",
    reward_amount: 50000,
    type: "unverified",
    categoryLabel: "Survey",
    estTime: "~4m",
  },
  {
    id: "sample-5",
    title: "Subscribe to a YouTube channel and upload screenshot",
    reward_amount: 25000,
    type: "verified",
    categoryLabel: "Social",
    estTime: "~1m",
  },
  {
    id: "sample-6",
    title: "Read Nigerian headlines on the in-app news feed",
    reward_amount: 200,
    type: "unverified",
    categoryLabel: "News",
    estTime: "Per min",
  },
]

async function getLandingData(): Promise<{
  tasks: LiveTaskPreview[]
  isLiveTasks: boolean
  minWithdrawalKobo: number
}> {
  try {
    const admin = createAdminClient()
    const [tasksRes, settingRes] = await Promise.all([
      admin
        .from("tasks")
        .select("id, title, reward_amount, type, youtube_url, min_watch_seconds, social_platform")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6),
      admin
        .from("platform_settings")
        .select("value")
        .eq("key", "min_withdrawal_kobo")
        .maybeSingle(),
    ])

    const minWithdrawalKobo =
      settingRes.data?.value != null && Number(settingRes.data.value) > 0
        ? Number(settingRes.data.value)
        : 500000

    const rows = tasksRes.data ?? []
    if (rows.length > 0) {
      const mapped: LiveTaskPreview[] = rows.map((t) => {
        const isVideo = Boolean(t.youtube_url)
        const isSocial = Boolean(t.social_platform)
        const categoryLabel = isVideo
          ? "Video"
          : isSocial
            ? "Social"
            : t.type === "verified"
              ? "Verified"
              : "Quick Task"
        const estTime = isVideo
          ? `~${Math.max(1, Math.ceil((t.min_watch_seconds ?? 60) / 60))}m`
          : t.type === "verified"
            ? "~1m"
            : "~30s"

        return {
          id: t.id,
          title: t.title,
          reward_amount: t.reward_amount,
          type: t.type as "verified" | "unverified",
          categoryLabel,
          estTime,
        }
      })
      return { tasks: mapped, isLiveTasks: true, minWithdrawalKobo }
    }

    return { tasks: FALLBACK_TASKS, isLiveTasks: false, minWithdrawalKobo }
  } catch {
    return { tasks: FALLBACK_TASKS, isLiveTasks: false, minWithdrawalKobo: 500000 }
  }
}

const EARNING_STREAMS = [
  {
    index: "01",
    name: "Social & Micro-Tasks",
    summary: "Follow, like, comment, review, or test apps for Nigerian brands. Instant credit on quick tasks; AI and human review on proof-based tasks.",
    meta: "30 sec – 2 min per task",
    href: "/register",
  },
  {
    index: "02",
    name: "Watch & Earn Videos",
    summary: "Watch partner YouTube videos in the built-in player with verified playback tracking. Rewards credit automatically once watch time completes.",
    meta: "1 – 5 min per video",
    href: "/register",
  },
  {
    index: "03",
    name: "Daily Skill Games",
    summary: "Play Wordle, 2048, Color Rush, Tap Target, Word Scramble, and Higher or Lower. Top weekly leaderboard players split the prize pool.",
    meta: "Weekly Naira pools",
    href: "/register",
  },
  {
    index: "04",
    name: "Read & Earn News",
    summary: "Stay updated with curated Nigerian news from local publications and earn per active reading minute straight to your wallet.",
    meta: "Per-minute credit",
    href: "/register",
  },
]

const PAYOUT_STEPS = [
  {
    step: "1",
    title: "Create a free account",
    body: "Sign up with your email in under a minute. No debit card, no subscription, and no registration fee.",
  },
  {
    step: "2",
    title: "Complete tasks you choose",
    body: "Every task shows its exact Naira reward, review type, and estimated time before you start.",
  },
  {
    step: "3",
    title: "Build your wallet balance",
    body: "Approved tasks, video watches, news reading, and referral bonuses settle directly into your Naira ledger.",
  },
  {
    step: "4",
    title: "Withdraw to your Nigerian bank",
    body: "Link any Paystack-verified bank account (OPay, PalmPay, Kuda, GTBank, Access, Zenith, UBA, First Bank) and request transfer.",
  },
]

const TRANSPARENCY_FACTS = [
  {
    label: "Registration",
    title: "Free to join, always",
    body: "Creating an account and earning on BountyTask requires zero upfront payment or card details.",
  },
  {
    label: "Bank Verification",
    title: "Paystack name-match",
    body: "Your withdrawal bank account is resolved directly through Paystack so transfers go to your real name without typos.",
  },
  {
    label: "Review Integrity",
    title: "Honest approval timelines",
    body: "Quick tasks credit immediately. Social screenshot tasks are checked by Gemini Vision AI and escalated to human reviewers when uncertain.",
  },
  {
    label: "Referrals",
    title: "₦500 per active friend",
    body: "Share your personal invite link. Once your friend joins and completes their first approved task, ₦500 is credited to your balance.",
  },
]

export default async function LandingPage() {
  const { tasks, isLiveTasks, minWithdrawalKobo } = await getLandingData()
  const minWithdrawalLabel = formatCurrency(minWithdrawalKobo)

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1">
        {/* ─── Hero: Asymmetric Editorial Split ─────────────────────────────── */}
        <section className="border-b border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-start">
              {/* Left: Editorial Copy */}
              <div className="lg:col-span-7 space-y-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  BountyTask · Nigeria
                </p>

                <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-[-0.035em] leading-[1.06] text-foreground">
                  Earn Naira for everyday digital tasks.
                </h1>

                <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
                  Complete verified social actions, watch short videos, read local news,
                  or compete in daily skill games. Every reward settles in Naira and
                  withdraws directly to any Nigerian bank account.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <Button size="lg" className="text-sm font-semibold px-7 h-11" asChild>
                    <Link href="/register">
                      Start earning free
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="text-sm font-medium h-11" asChild>
                    <Link href="#how-it-works">How payouts work</Link>
                  </Button>
                </div>

                {/* Plain-spoken terms strip */}
                <dl className="grid grid-cols-3 gap-4 pt-6 border-t border-border max-w-lg">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Welcome bonus
                    </dt>
                    <dd className="text-base sm:text-lg font-semibold tabular-nums mt-0.5">
                      ₦200
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Min. withdrawal
                    </dt>
                    <dd className="text-base sm:text-lg font-semibold tabular-nums mt-0.5">
                      {minWithdrawalLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Payout window
                    </dt>
                    <dd className="text-base sm:text-lg font-semibold tabular-nums mt-0.5">
                      24 – 48h
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Right: Live Marketplace Ledger Sheet */}
              <div className="lg:col-span-5">
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
                    <span className="text-xs font-semibold text-foreground">
                      {isLiveTasks ? "Active tasks right now" : "Example task board"}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      Settled in NGN
                    </span>
                  </div>

                  <ul className="divide-y divide-border">
                    {tasks.slice(0, 5).map((task) => (
                      <li
                        key={task.id}
                        className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {task.categoryLabel} · {task.estTime} ·{" "}
                            {task.type === "verified" ? "Reviewed" : "Instant"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          +{formatCurrency(task.reward_amount)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Sign up to claim &amp; track rewards
                    </span>
                    <Link
                      href="/register"
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Open marketplace
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Real Verified Payouts / Guarantee Strip ─────────────────────── */}
        <RecentPayoutsStrip />

        {/* ─── Four Ways to Earn (Editorial Bands) ─────────────────────────── */}
        <section className="py-20 sm:py-24 px-4 sm:px-6 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-xl mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
                Ways to earn
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.025em]">
                Four ways to build your balance, all in one wallet.
              </h2>
            </div>

            <div className="divide-y divide-border border-t border-b border-border">
              {EARNING_STREAMS.map((stream) => (
                <div
                  key={stream.index}
                  className="py-6 sm:py-7 grid md:grid-cols-12 gap-3 md:gap-6 items-baseline"
                >
                  <div className="md:col-span-4 flex items-baseline gap-4">
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {stream.index}
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">
                      {stream.name}
                    </h3>
                  </div>
                  <p className="md:col-span-6 text-sm text-muted-foreground leading-relaxed">
                    {stream.summary}
                  </p>
                  <div className="md:col-span-2 md:text-right">
                    <span className="text-xs font-medium text-foreground/80">
                      {stream.meta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── How Payouts Work (Hairline Ledger Steps) ────────────────────── */}
        <section id="how-it-works" className="py-20 sm:py-24 px-4 sm:px-6 bg-muted/20 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-xl mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
                How it works
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.025em]">
                From signup to Nigerian bank transfer in four steps.
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {PAYOUT_STEPS.map((item) => (
                <div key={item.step} className="pt-5 border-t-2 border-foreground/15">
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    Step {item.step}
                  </span>
                  <h3 className="text-base font-semibold text-foreground mt-2 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Radical Transparency / Trust Rules ──────────────────────────── */}
        <section className="py-20 sm:py-24 px-4 sm:px-6 border-b border-border">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
                  Straight rules
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.025em] mb-3">
                  What to expect before you sign up.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No hidden catch, no inflated promises. Here is how BountyTask
                  handles accounts, reviews, and withdrawals.
                </p>
                <div className="mt-6">
                  <Link
                    href="/faq"
                    className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Read the full FAQ
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-8 grid sm:grid-cols-2 gap-x-8 gap-y-8">
                {TRANSPARENCY_FACTS.map((fact) => (
                  <div key={fact.label} className="pt-4 border-t border-border">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {fact.label}
                    </p>
                    <h3 className="text-base font-semibold text-foreground mt-1.5 mb-1.5">
                      {fact.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {fact.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── For Businesses / Advertisers Band ───────────────────────────── */}
        <section className="py-12 px-4 sm:px-6 bg-muted/30 border-b border-border">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Promoting a Nigerian brand, creator channel, or mobile app?
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Launch a verified task campaign and pay only for real completed actions.
              </p>
            </div>
            <Button variant="outline" className="shrink-0" asChild>
              <Link href="/advertise">
                Advertise on BountyTask
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ─── Editorial Closing CTA ───────────────────────────────────────── */}
        <section className="bg-foreground text-background py-20 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] leading-tight">
                Open your account and claim your first task today.
              </h2>
              <p className="text-sm sm:text-base text-background/70 mt-3 leading-relaxed">
                Free registration, ₦200 welcome bonus once verified, and direct payouts
                to Nigerian bank accounts.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <Button
                size="lg"
                className="bg-background text-foreground hover:bg-background/90 font-semibold px-7 h-11"
                asChild
              >
                <Link href="/register">
                  Create free account
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-background border border-background/25 hover:bg-background/10 hover:text-background h-11"
                asChild
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
