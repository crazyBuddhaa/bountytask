import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { checkInMemoryRateLimit } from "@/lib/security"
import { getClientIp } from "@/lib/utils"

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().email("Enter a valid email address").max(200),
  subject: z.string().trim().min(2, "Please select a subject").max(150),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers) ?? "unknown"
  const { allowed, retryAfterSec } = checkInMemoryRateLimit(
    `contact:${ip}`,
    5,
    15 * 60 * 1000
  )

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many messages sent. Please wait a few minutes and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Please check your inputs and try again."
    return NextResponse.json({ error: firstIssue }, { status: 400 })
  }

  const { name, email, subject, message } = parsed.data
  const to = process.env.ADMIN_EMAIL || "support@bountytask.ng"

  if (!process.env.RESEND_API_KEY) {
    console.info("[contact] RESEND_API_KEY unset — skipping email send:", {
      to,
      name,
      email,
      subject,
      messageLength: message.length,
    })
    return NextResponse.json({ ok: true })
  }

  const fromDomain =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, "").replace(/\/.*$/, "") ||
    "bountytask.dpdns.org"
  const from = `BountyTask Support <noreply@${fromDomain}>`

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827">
      <h2 style="margin:0 0 16px;font-size:20px">New Contact Form Message</h2>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;font-size:14px">
        <tr><td style="padding:4px 0;color:#6b7280;width:90px"><strong>From:</strong></td><td>${escapeHtml(name)} (&lt;${escapeHtml(email)}&gt;)</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280"><strong>Subject:</strong></td><td>${escapeHtml(subject)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280"><strong>IP:</strong></td><td>${escapeHtml(ip)}</td></tr>
      </table>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.6">${escapeHtml(message)}</div>
    </div>
  `

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: email,
        subject: `[Contact] ${subject} — ${name}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("[contact] Email send failed:", err)
      return NextResponse.json(
        { error: "Unable to send your message right now. Please try again later." },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[contact] Unexpected error sending email:", err)
    return NextResponse.json(
      { error: "Unable to send your message right now. Please try again later." },
      { status: 500 }
    )
  }
}
