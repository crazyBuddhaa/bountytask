/**
 * BountyTask — Email Templates
 *
 * All transactional emails share a single branded base layout.
 * The Supabase auth emails (confirm signup, password reset, magic link)
 * must be customised directly in the Supabase dashboard using the
 * exported `supabaseTemplates` objects at the bottom of this file.
 */

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://bountytask.dpdns.org"

const LOGO_URL   = `${APP_URL}/logo.png`
const PRIMARY    = "#7c3aed"
const PRIMARY_DK = "#6d28d9"
const GREEN      = "#16a34a"
const RED        = "#dc2626"
const ORANGE     = "#ea580c"

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function btn(href: string, label: string, color = PRIMARY) {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
      <tr>
        <td align="center" bgcolor="${color}" style="border-radius:8px">
          <a href="${href}"
             style="display:inline-block;padding:12px 28px;color:#ffffff;
                    font-size:15px;font-weight:600;text-decoration:none;
                    border-radius:8px;letter-spacing:0.1px">
            ${label}
          </a>
        </td>
      </tr>
    </table>`
}

function divider() {
  return `<div style="border-top:1px solid #f3f4f6;margin:24px 0"></div>`
}

function badge(text: string, color: string) {
  return `<span style="display:inline-block;background:${color}18;color:${color};
    font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;
    padding:4px 10px;border-radius:20px;margin-bottom:16px">${text}</span>`
}

function base({
  preheader,
  accentColor = PRIMARY,
  accentLabel,
  body,
}: {
  preheader: string
  accentColor?: string
  accentLabel?: string
  body: string
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
             'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">

  <!-- preheader hidden text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preheader}&nbsp;&zwnj;</div>

  <!-- outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f1f5f9;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px">

          <!-- ── HEADER ──────────────────────────────────── -->
          <tr>
            <td style="background:${accentColor};border-radius:14px 14px 0 0;
                        padding:32px 40px;text-align:center">
              <img src="${LOGO_URL}" alt="BountyTask logo"
                   width="48" height="48"
                   style="border-radius:12px;display:block;margin:0 auto 14px;
                          border:0;outline:none"/>
              <div style="color:#ffffff;font-size:22px;font-weight:800;
                          letter-spacing:-0.5px">BountyTask</div>
              ${accentLabel
                ? `<div style="color:rgba(255,255,255,0.75);font-size:13px;
                               margin-top:4px;letter-spacing:0.3px">${accentLabel}</div>`
                : ""}
            </td>
          </tr>

          <!-- ── BODY ───────────────────────────────────── -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px 32px;
                       border-radius:0 0 14px 14px;
                       box-shadow:0 4px 24px rgba(0,0,0,0.07)">

              <div style="color:#111827;font-size:15px;line-height:1.7">
                ${body}
              </div>

              ${divider()}

              <!-- footer inside card -->
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;
                         text-align:center">
                You received this email because you have a BountyTask account.<br/>
                Questions? Reply to this email or visit
                <a href="${APP_URL}/contact"
                   style="color:${accentColor};text-decoration:none">our help page</a>.
              </p>
            </td>
          </tr>

          <!-- ── OUTER FOOTER ─────────────────────────────── -->
          <tr>
            <td style="padding:24px 0;text-align:center">
              <p style="margin:0 0 6px;color:#9ca3af;font-size:12px">
                © ${new Date().getFullYear()} BountyTask Nigeria ·
                <a href="${APP_URL}" style="color:#9ca3af;text-decoration:underline">
                  ${APP_URL.replace("https://", "")}
                </a>
              </p>
              <p style="margin:0;color:#cbd5e1;font-size:11px">
                Nigeria's #1 task-to-earn platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: Welcome (sent after first sign-in / email confirm)
// ─────────────────────────────────────────────────────────────────────────────

export function welcomeEmail(name: string) {
  return base({
    preheader: "Welcome to BountyTask — start earning Naira today!",
    accentColor: PRIMARY,
    accentLabel: "Welcome aboard 🎉",
    body: `
      <h2 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827">
        Hey ${name}, welcome! 👋
      </h2>
      <p style="margin:0 0 20px;color:#4b5563">
        You've joined Nigeria's #1 task-to-earn platform. Here's how to get
        your first Naira credits in your pocket:
      </p>

      <!-- Steps -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%"
             style="margin-bottom:24px">
        ${[
          ["01", PRIMARY, "Complete your profile",
           "Add your full name and profile photo — it unlocks higher-value tasks."],
          ["02", PRIMARY_DK, "Browse available tasks",
           "Short tasks, surveys, and offers — each with an instant ₦ reward."],
          ["03", GREEN, "Verify your bank account",
           "A one-time ₦50 micro-deposit proves your account for secure withdrawals."],
          ["04", "#0ea5e9", "Withdraw anytime",
           "Cash out directly to your Nigerian bank account — no minimums."],
        ].map(([num, color, title, desc]) => `
          <tr>
            <td style="padding:0 0 16px">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px">
                    <div style="width:36px;height:36px;border-radius:50%;
                                background:${color};color:#fff;font-weight:800;
                                font-size:13px;text-align:center;line-height:36px">
                      ${num}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:700;color:#111827;font-size:14px;
                                margin-bottom:2px">${title}</div>
                    <div style="color:#6b7280;font-size:13px">${desc}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`).join("")}
      </table>

      ${btn(`${APP_URL}/dashboard`, "Go to my Dashboard")}

      <p style="margin:0;color:#9ca3af;font-size:13px">
        Have questions? Check our
        <a href="${APP_URL}/faq" style="color:${PRIMARY};text-decoration:none">FAQ</a>
        or reply directly to this email.
      </p>`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: Task Approved
// ─────────────────────────────────────────────────────────────────────────────

export function taskApprovedEmail(
  name: string,
  taskTitle: string,
  rewardNaira: string,
  newBalanceNaira: string
) {
  return base({
    preheader: `₦${rewardNaira} credited — your task was approved!`,
    accentColor: GREEN,
    accentLabel: "Task Approved",
    body: `
      ${badge("Approved", GREEN)}
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
        Great work, ${name}! 🎉
      </h2>
      <p style="margin:0 0 20px;color:#4b5563">
        Your submission has been reviewed and approved. Here's what happened:
      </p>

      <!-- Summary box -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%"
             style="background:#f0fdf4;border-radius:10px;margin-bottom:24px">
        <tr>
          <td style="padding:20px 24px">
            <div style="color:#6b7280;font-size:12px;font-weight:600;
                        text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
              Task
            </div>
            <div style="color:#111827;font-weight:600;font-size:15px;margin-bottom:16px">
              ${taskTitle}
            </div>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="50%">
                  <div style="color:#6b7280;font-size:12px;font-weight:600;
                              text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
                    Reward Credited
                  </div>
                  <div style="color:${GREEN};font-size:22px;font-weight:800">
                    +₦${rewardNaira}
                  </div>
                </td>
                <td width="50%">
                  <div style="color:#6b7280;font-size:12px;font-weight:600;
                              text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
                    New Balance
                  </div>
                  <div style="color:#111827;font-size:22px;font-weight:800">
                    ₦${newBalanceNaira}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${btn(`${APP_URL}/dashboard/earnings`, "View My Earnings", GREEN)}

      <p style="margin:0;color:#6b7280;font-size:13px">
        Keep completing tasks to grow your balance. You can withdraw anytime
        your account is verified.
      </p>`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: Task Rejected
// ─────────────────────────────────────────────────────────────────────────────

export function taskRejectedEmail(
  name: string,
  taskTitle: string,
  reason: string
) {
  return base({
    preheader: `Your submission for "${taskTitle}" needs attention`,
    accentColor: RED,
    accentLabel: "Submission Update",
    body: `
      ${badge("Not Approved", RED)}
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
        Hi ${name}, a quick update
      </h2>
      <p style="margin:0 0 20px;color:#4b5563">
        We reviewed your submission for the task below and unfortunately could
        not approve it this time.
      </p>

      <!-- Task box -->
      <div style="background:#fef2f2;border-left:4px solid ${RED};
                  border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
        <div style="color:#6b7280;font-size:12px;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
          Task
        </div>
        <div style="color:#111827;font-weight:600;font-size:15px;margin-bottom:12px">
          ${taskTitle}
        </div>
        <div style="color:#6b7280;font-size:12px;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
          Reason
        </div>
        <div style="color:#374151;font-size:14px">${reason}</div>
      </div>

      <p style="margin:0 0 20px;color:#4b5563">
        Don't be discouraged — there are plenty more tasks available. Read the
        task instructions carefully before submitting and you'll be approved
        in no time.
      </p>

      ${btn(`${APP_URL}/dashboard/tasks`, "Browse More Tasks", PRIMARY)}

      <p style="margin:0;color:#9ca3af;font-size:13px">
        If you believe this decision was made in error, reply to this email
        with your proof of completion.
      </p>`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: Withdrawal Approved
// ─────────────────────────────────────────────────────────────────────────────

export function withdrawalApprovedEmail(name: string, amountNaira: string) {
  return base({
    preheader: `₦${amountNaira} withdrawal approved — funds on the way!`,
    accentColor: GREEN,
    accentLabel: "Withdrawal Approved",
    body: `
      ${badge("Payment Approved", GREEN)}
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
        Your money is on the way, ${name}! 💸
      </h2>
      <p style="margin:0 0 20px;color:#4b5563">
        Your withdrawal request has been reviewed and approved. Here are the
        details:
      </p>

      <!-- Amount box -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%"
             style="background:#f0fdf4;border-radius:10px;margin-bottom:24px">
        <tr>
          <td style="padding:24px;text-align:center">
            <div style="color:#6b7280;font-size:13px;margin-bottom:8px">
              Amount approved
            </div>
            <div style="color:${GREEN};font-size:36px;font-weight:800;
                        letter-spacing:-1px">
              ₦${amountNaira}
            </div>
            <div style="color:#6b7280;font-size:13px;margin-top:8px">
              Transfer to your verified bank account
            </div>
          </td>
        </tr>
      </table>

      <!-- Timeline -->
      <div style="background:#f9fafb;border-radius:10px;padding:20px 24px;
                  margin-bottom:24px">
        <div style="font-weight:700;color:#111827;font-size:14px;margin-bottom:12px">
          What happens next
        </div>
        ${[
          [GREEN, "Withdrawal approved ✓"],
          ["#d1d5db", "Manual bank transfer initiated (within 24 h)"],
          ["#d1d5db", "Funds arrive in your account"],
        ].map(([color, text]) => `
          <div style="display:flex;align-items:center;margin-bottom:8px">
            <div style="width:10px;height:10px;border-radius:50%;
                        background:${color};margin-right:12px;flex-shrink:0"></div>
            <div style="color:#374151;font-size:13px">${text}</div>
          </div>`).join("")}
      </div>

      ${btn(`${APP_URL}/dashboard/earnings`, "View Transaction History", GREEN)}`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: Withdrawal Rejected
// ─────────────────────────────────────────────────────────────────────────────

export function withdrawalRejectedEmail(
  name: string,
  amountNaira: string,
  reason?: string
) {
  return base({
    preheader: `Update on your ₦${amountNaira} withdrawal request`,
    accentColor: RED,
    accentLabel: "Withdrawal Update",
    body: `
      ${badge("Not Approved", RED)}
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
        Hi ${name}, we couldn't process this withdrawal
      </h2>
      <p style="margin:0 0 20px;color:#4b5563">
        Your withdrawal request of <strong>₦${amountNaira}</strong> has been
        reviewed but could not be approved at this time.
      </p>

      ${reason ? `
        <div style="background:#fef2f2;border-left:4px solid ${RED};
                    border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
          <div style="color:#6b7280;font-size:12px;font-weight:600;
                      text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
            Reason
          </div>
          <div style="color:#374151;font-size:14px">${reason}</div>
        </div>` : ""}

      <p style="margin:0 0 20px;color:#4b5563">
        Your balance has <strong>not</strong> been deducted. You can submit a
        new withdrawal request once any outstanding issues are resolved.
      </p>

      ${btn(`${APP_URL}/dashboard/withdrawal`, "Try Again", PRIMARY)}

      <p style="margin:0;color:#9ca3af;font-size:13px">
        Questions about this decision? Reply to this email with your
        details and we'll look into it.
      </p>`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: Bank Verification Approved
// ─────────────────────────────────────────────────────────────────────────────

export function verificationApprovedEmail(name: string) {
  return base({
    preheader: "Your account is verified — withdrawals are now unlocked!",
    accentColor: GREEN,
    accentLabel: "Account Verified",
    body: `
      ${badge("Verified ✓", GREEN)}
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
        You're verified, ${name}! 🔓
      </h2>
      <p style="margin:0 0 20px;color:#4b5563">
        Your bank account has been verified. You can now withdraw your
        BountyTask earnings directly to your Nigerian bank account — anytime,
        no minimums.
      </p>

      <!-- Feature list -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%"
             style="background:#f0fdf4;border-radius:10px;margin-bottom:24px">
        <tr>
          <td style="padding:20px 24px">
            ${[
              ["₦ Instant credits", "Rewards land the moment your task is approved."],
              ["Manual bank transfer", "Request a withdrawal and receive funds within 24 h."],
              ["Secure & verified", "Your bank details are locked in — no re-verification needed."],
            ].map(([title, desc]) => `
              <div style="margin-bottom:12px">
                <div style="font-weight:700;color:#111827;font-size:14px">✓ ${title}</div>
                <div style="color:#6b7280;font-size:13px">${desc}</div>
              </div>`).join("")}
          </td>
        </tr>
      </table>

      ${btn(`${APP_URL}/dashboard/withdrawal`, "Withdraw My Earnings", GREEN)}`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: Bank Verification Rejected
// ─────────────────────────────────────────────────────────────────────────────

export function verificationRejectedEmail(name: string, reason: string | null) {
  return base({
    preheader: "Action needed — your bank verification could not be confirmed",
    accentColor: ORANGE,
    accentLabel: "Verification Update",
    body: `
      ${badge("Needs Attention", ORANGE)}
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
        Hi ${name}, we need your help
      </h2>
      <p style="margin:0 0 20px;color:#4b5563">
        We were unable to confirm your ₦50 bank verification transfer. You'll
        need to resubmit once the issue is resolved.
      </p>

      ${reason ? `
        <div style="background:#fff7ed;border-left:4px solid ${ORANGE};
                    border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
          <div style="color:#6b7280;font-size:12px;font-weight:600;
                      text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
            What went wrong
          </div>
          <div style="color:#374151;font-size:14px">${reason}</div>
        </div>` : ""}

      <!-- Steps to fix -->
      <div style="background:#f9fafb;border-radius:10px;padding:20px 24px;
                  margin-bottom:24px">
        <div style="font-weight:700;color:#111827;font-size:14px;margin-bottom:12px">
          How to fix this
        </div>
        ${[
          "Send exactly <strong>₦50</strong> from the bank account you want to verify.",
          "Use the same reference code shown on the verification page.",
          "Allow up to 30 minutes for the transfer to appear before submitting.",
          "Resubmit your verification request with a clear screenshot of the transfer receipt.",
        ].map((step, i) => `
          <div style="display:flex;margin-bottom:10px">
            <div style="width:22px;height:22px;border-radius:50%;background:${ORANGE};
                        color:#fff;font-weight:700;font-size:11px;text-align:center;
                        line-height:22px;margin-right:12px;flex-shrink:0">${i + 1}</div>
            <div style="color:#374151;font-size:13px;line-height:1.6">${step}</div>
          </div>`).join("")}
      </div>

      ${btn(`${APP_URL}/dashboard/withdrawal`, "Resubmit Verification", ORANGE)}

      <p style="margin:0;color:#9ca3af;font-size:13px">
        Still having trouble? Reply to this email and attach your payment
        receipt — we'll sort it out together.
      </p>`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: Admin Broadcast
// ─────────────────────────────────────────────────────────────────────────────

export function adminBroadcastEmail(title: string, message: string) {
  return base({
    preheader: title,
    accentColor: PRIMARY,
    accentLabel: "Message from BountyTask",
    body: `
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111827">
        ${title}
      </h2>
      <div style="color:#374151;font-size:15px;line-height:1.8;
                  white-space:pre-wrap">${message}</div>
      ${divider()}
      ${btn(`${APP_URL}/dashboard`, "Go to Dashboard")}`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: Login / Re-engagement Reminder
// ─────────────────────────────────────────────────────────────────────────────

export function loginReminderEmail(name: string, balanceNaira: string) {
  return base({
    preheader: `${name}, you have ₦${balanceNaira} waiting — new tasks are ready`,
    accentColor: PRIMARY,
    accentLabel: "We miss you!",
    body: `
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
        Hey ${name}, new tasks are waiting 👀
      </h2>
      <p style="margin:0 0 20px;color:#4b5563">
        You haven't visited BountyTask in a while — come back and keep earning!
      </p>

      <!-- Balance pill -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%"
             style="background:linear-gradient(135deg,#7c3aed,#a855f7);
                    border-radius:12px;margin-bottom:24px">
        <tr>
          <td style="padding:24px;text-align:center">
            <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-bottom:6px">
              Your current balance
            </div>
            <div style="color:#ffffff;font-size:36px;font-weight:800;
                        letter-spacing:-1px">
              ₦${balanceNaira}
            </div>
            <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:6px">
              Ready to grow with your next task
            </div>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 20px;color:#4b5563">
        Fresh tasks are added daily — surveys, offers, and quick jobs with
        instant ₦ rewards. Log back in and pick up where you left off.
      </p>

      ${btn(`${APP_URL}/dashboard/tasks`, "See Today's Tasks")}

      <p style="margin:0;color:#9ca3af;font-size:13px">
        To stop receiving reminder emails, update your preferences in
        <a href="${APP_URL}/dashboard/profile"
           style="color:${PRIMARY};text-decoration:none">your profile</a>.
      </p>`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE AUTH TEMPLATES
// These HTML strings are meant to be pasted into the Supabase Dashboard at:
//   Authentication → Email Templates → [Confirm signup / Reset password / Magic Link]
// Use the Supabase template variables {{ .ConfirmationURL }}, {{ .Token }}, etc.
// ─────────────────────────────────────────────────────────────────────────────

export const supabaseConfirmSignupHtml = base({
  preheader: "Confirm your email to activate your BountyTask account",
  accentColor: PRIMARY,
  accentLabel: "Email Confirmation",
  body: `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
      Confirm your email address
    </h2>
    <p style="margin:0 0 20px;color:#4b5563">
      Thanks for signing up for BountyTask! Click the button below to verify
      your email address and activate your account.
    </p>

    ${btn("{{ .ConfirmationURL }}", "Confirm My Email")}

    <p style="margin:0 0 8px;color:#9ca3af;font-size:13px">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0;word-break:break-all;font-size:12px;color:#6b7280">
      {{ .ConfirmationURL }}
    </p>
    ${divider()}
    <p style="margin:0;color:#9ca3af;font-size:13px">
      This link expires in 24 hours. If you didn't create a BountyTask account,
      you can safely ignore this email.
    </p>`,
})

export const supabasePasswordResetHtml = base({
  preheader: "Reset your BountyTask password",
  accentColor: ORANGE,
  accentLabel: "Password Reset",
  body: `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
      Reset your password
    </h2>
    <p style="margin:0 0 20px;color:#4b5563">
      We received a request to reset the password for your BountyTask account.
      Click the button below to choose a new password.
    </p>

    ${btn("{{ .ConfirmationURL }}", "Reset My Password", ORANGE)}

    <p style="margin:0 0 8px;color:#9ca3af;font-size:13px">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0;word-break:break-all;font-size:12px;color:#6b7280">
      {{ .ConfirmationURL }}
    </p>
    ${divider()}
    <p style="margin:0;color:#9ca3af;font-size:13px">
      This link expires in 1 hour. If you didn't request a password reset,
      ignore this email — your password won't be changed.
    </p>`,
})

export const supabaseMagicLinkHtml = base({
  preheader: "Your BountyTask sign-in link",
  accentColor: PRIMARY,
  accentLabel: "Sign In Link",
  body: `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
      Your sign-in link
    </h2>
    <p style="margin:0 0 20px;color:#4b5563">
      Click the button below to sign in to your BountyTask account.
      No password needed.
    </p>

    ${btn("{{ .ConfirmationURL }}", "Sign In to BountyTask")}

    <p style="margin:0 0 8px;color:#9ca3af;font-size:13px">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0;word-break:break-all;font-size:12px;color:#6b7280">
      {{ .ConfirmationURL }}
    </p>
    ${divider()}
    <p style="margin:0;color:#9ca3af;font-size:13px">
      This link expires in 1 hour and can only be used once.
      If you didn't request this link, you can safely ignore this email.
    </p>`,
})

export const supabaseChangeEmailHtml = base({
  preheader: "Confirm your new email address for BountyTask",
  accentColor: PRIMARY,
  accentLabel: "Email Change",
  body: `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827">
      Confirm your new email
    </h2>
    <p style="margin:0 0 20px;color:#4b5563">
      You requested to change the email address on your BountyTask account.
      Click below to confirm the change.
    </p>

    ${btn("{{ .ConfirmationURL }}", "Confirm Email Change")}

    <p style="margin:0 0 8px;color:#9ca3af;font-size:13px">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0;word-break:break-all;font-size:12px;color:#6b7280">
      {{ .ConfirmationURL }}
    </p>
    ${divider()}
    <p style="margin:0;color:#9ca3af;font-size:13px">
      If you didn't request this change, reply to this email immediately
      so we can secure your account.
    </p>`,
})
