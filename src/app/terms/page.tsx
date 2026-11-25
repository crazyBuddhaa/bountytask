import Link from "next/link"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service governing your use of BountyTask.",
}

const sections = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account or using BountyTask, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree with any part of these terms, you may not access or use the platform.",
  },
  {
    title: "2. Eligibility & Accounts",
    body: "You must be at least 18 years old and provide accurate, complete registration information. Each individual is permitted only one BountyTask account. Creating multiple accounts, using automated tools, or sharing accounts is strictly prohibited and may result in permanent suspension and forfeiture of unpaid balances.",
  },
  {
    title: "3. Completing Tasks & Proof of Work",
    body: "Tasks must be completed honestly and in full accordance with the instructions provided. For verified tasks, you must submit genuine, unaltered proof of completion. Duplicate submissions, fabricated screenshots, or any attempt to game task verification will result in rejection and potential account termination.",
  },
  {
    title: "4. Rewards, Bonuses & Referrals",
    body: "Task rewards are credited in Naira (₦) to your BountyTask wallet upon completion (for instant tasks) or admin approval (for verified tasks). Signup and referral bonuses are subject to platform eligibility rules, including completion of qualifying tasks and account verification where enabled. BountyTask reserves the right to adjust reward amounts or pause promotional bonuses at any time.",
  },
  {
    title: "5. Bank Verification & Withdrawals",
    body: "Withdrawals are sent to verified Nigerian bank accounts that match your registered profile name. Minimum withdrawal thresholds and processing windows (typically 1–2 business days after approval) apply. BountyTask reserves the right to hold or decline withdrawals flagged for fraud review.",
  },
  {
    title: "6. Advertisers & Task Submissions",
    body: "Advertisers submitting tasks represent that their campaigns comply with applicable laws and do not promote scams, malware, hate speech, or prohibited content. All advertiser campaigns are subject to review before publication. Submission fees, where applicable, are non-refundable once review has commenced.",
  },
  {
    title: "7. Prohibited Conduct",
    body: "You agree not to reverse-engineer, scrape, overload, or interfere with the platform; bypass rate limits or security controls; or engage in abusive or fraudulent behavior toward BountyTask staff, advertisers, or other users.",
  },
  {
    title: "8. Suspension & Termination",
    body: "We may suspend or terminate your account at our discretion if we detect fraud, abuse, or a violation of these Terms. You may request account closure at any time by contacting support.",
  },
  {
    title: "9. Limitation of Liability",
    body: "BountyTask is provided on an 'as-is' and 'as-available' basis. To the fullest extent permitted by law, BountyTask is not liable for indirect, incidental, or consequential damages, or for delays caused by third-party payment or banking networks.",
  },
  {
    title: "10. Changes to These Terms",
    body: "We may update these Terms from time to time. Continued use of BountyTask after changes are posted constitutes acceptance of the revised Terms.",
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="py-16 px-4 text-center border-b border-border bg-muted/20">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-extrabold mb-3">Terms of Service</h1>
            <p className="text-muted-foreground">
              Please read these terms carefully before using BountyTask.
            </p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {sections.map(({ title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-semibold text-base mb-2">{title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12 px-4 text-center border-t border-border bg-muted/20">
          <div className="max-w-xl mx-auto">
            <p className="text-muted-foreground mb-4">
              Questions about these terms? Our team is happy to clarify.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="gradient" asChild>
                <Link href="/contact">Contact Support</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/privacy">Privacy Policy</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
