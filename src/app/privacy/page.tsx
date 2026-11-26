import Link from "next/link"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Privacy Policy",
  description: "How BountyTask collects, uses, and protects your personal information.",
}

const sections = [
  {
    title: "1. Information We Collect",
    body: "When you register and use BountyTask, we collect information you provide directly — including your full name, email address, profile photo, task proof submissions, and bank account details (bank name, account number, and resolved account name) used for withdrawals. We also collect technical data such as IP address, device/browser metadata, and usage logs to keep the platform secure.",
  },
  {
    title: "2. How We Use Your Information",
    body: "We use your information to operate your account, verify task completions, credit rewards, process bank verification and withdrawals, prevent fraud and duplicate accounts, send transactional notifications, and respond to support inquiries.",
  },
  {
    title: "3. Banking & Payment Security",
    body: "Bank account verification and advertiser payments are processed through Paystack. BountyTask never asks for or stores your banking PIN, card CVV, or BVN. Your bank account number and resolved account name are stored solely to disburse approved withdrawals.",
  },
  {
    title: "4. Cookies & Advertising",
    body: "We use essential cookies to maintain your authenticated session and preferences. Third-party advertising and survey partners may use cookies to serve relevant offers and ads. You can manage cookie preferences through your browser settings.",
  },
  {
    title: "5. Sharing of Information",
    body: "We do not sell your personal information. We share data only with trusted service providers necessary to run the platform (such as authentication, database hosting, email delivery, and payment verification) or when required by law.",
  },
  {
    title: "6. Data Retention",
    body: "We retain your account information and transaction history for as long as your account is active and as needed to comply with legal, accounting, and anti-fraud obligations.",
  },
  {
    title: "7. Your Rights & Choices",
    body: "You can update your profile details and notification preferences from your dashboard at any time. To request a copy of your data or deletion of your account, contact us through the Contact page.",
  },
  {
    title: "8. Policy Updates",
    body: "We may revise this Privacy Policy periodically. Any updates will be posted on this page, and continued use of BountyTask after changes take effect signifies your acceptance.",
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="py-16 px-4 text-center border-b border-border bg-muted/20">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-extrabold mb-3">Privacy Policy</h1>
            <p className="text-muted-foreground">
              How we collect, use, and safeguard your personal data on BountyTask.
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
              Have a privacy question or data request? Reach out to our team.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="gradient" asChild>
                <Link href="/contact">Contact Support</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/terms">Terms of Service</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
