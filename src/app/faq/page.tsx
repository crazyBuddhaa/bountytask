import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicHeader } from "@/components/layout/PublicHeader"
import { Footer } from "@/components/layout/Footer"

export const metadata = { title: "FAQ — BountyTask", description: "Frequently asked questions about BountyTask." }

const faqs = [
  {
    q: "Is BountyTask legitimate?",
    a: "Yes. BountyTask is a Nigerian task-to-earn platform that connects real businesses with real users. We have paid out over ₦5 million to earners every month. Every withdrawal goes directly to a verified Nigerian bank account.",
  },
  {
    q: "How do I get started?",
    a: "Create a free account, verify your email, and you'll receive ₦200 as a welcome bonus. Then browse the task marketplace, claim tasks you want to complete, and start earning.",
  },
  {
    q: "How quickly are tasks credited?",
    a: "Unverified (Instant) tasks are credited to your wallet immediately upon submission. Verified tasks require admin review, which typically takes 24–48 hours.",
  },
  {
    q: "What is the minimum withdrawal?",
    a: "The minimum withdrawal amount is ₦5,000. This helps us cover bank transfer fees while keeping them sustainable.",
  },
  {
    q: "How long does withdrawal take?",
    a: "Withdrawals are processed manually and paid within 1–2 business days of your request being approved. We notify you by email and in-app notification at each step.",
  },
  {
    q: "Is my bank account information safe?",
    a: "Yes. We use Paystack to verify your account number and name — we never store your PIN, BVN, or any sensitive banking credentials. Your account details are only used to send your withdrawal.",
  },
  {
    q: "Can I complete the same task twice?",
    a: "No. Each task can only be completed once per user. Attempting to submit the same task twice will result in a 409 error. Repeated fraud attempts may lead to account suspension.",
  },
  {
    q: "How does the referral program work?",
    a: "Share your unique referral link or code with friends. When they sign up and complete their first task, you earn ₦500 and they receive a ₦200 signup bonus — both automatically credited.",
  },
  {
    q: "What happens if my task submission is rejected?",
    a: "If a verified task is rejected, you'll receive a notification with the reason. The reward is not deducted since it was never credited for pending tasks. You may re-submit if you can address the rejection reason.",
  },
  {
    q: "Can I use BountyTask on mobile?",
    a: "Yes. BountyTask is fully responsive and works on any modern smartphone browser. We recommend using Chrome or Safari for the best experience.",
  },
  {
    q: "How do I report a problem or contact support?",
    a: "Use the Contact page to send us a message. We respond within 24 hours on business days.",
  },
]

export default function FAQPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <section className="py-16 px-4 text-center border-b border-border bg-muted/20">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-extrabold mb-3">Frequently Asked Questions</h1>
            <p className="text-muted-foreground">Everything you need to know about earning on BountyTask.</p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {faqs.map(({ q, a }) => (
              <div key={q} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-semibold text-base mb-2">{q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12 px-4 text-center border-t border-border bg-muted/20">
          <div className="max-w-xl mx-auto">
            <p className="text-muted-foreground mb-4">Still have questions? We&apos;re happy to help.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="gradient" asChild>
                <Link href="/contact">Contact Support</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/register">Start Earning <ArrowRight className="w-4 h-4" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
