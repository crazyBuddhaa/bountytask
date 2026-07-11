import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/types";

/** Create an in-app notification */
export async function createNotification({
  userId,
  type,
  title,
  message,
  refId,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  refId?: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    ref_id: refId ?? null,
    read: false,
  });
  if (error) console.error("Notification insert failed:", error.message);
}

/** Send email via Resend */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) return; // email optional

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `BountyTask <noreply@${process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, "") ?? "bountytask.com"}>`,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Email send failed:", err);
  }
}

/** Notify and email task approval */
export async function notifyTaskApproved(
  userId: string,
  email: string,
  taskTitle: string,
  rewardKobo: number,
  completionId: string
) {
  const naira = (rewardKobo / 100).toFixed(2);
  await Promise.all([
    createNotification({
      userId,
      type: "task_approved",
      title: "Task Approved! 🎉",
      message: `Your completion of "${taskTitle}" was approved. ₦${naira} has been credited to your account.`,
      refId: completionId,
    }),
    sendEmail({
      to: email,
      subject: "Task Approved — ₦" + naira + " credited",
      html: `<p>Your submission for <strong>${taskTitle}</strong> was approved.</p><p><strong>₦${naira}</strong> has been added to your BountyTask balance.</p>`,
    }),
  ]);
}

/** Notify and email task rejection */
export async function notifyTaskRejected(
  userId: string,
  email: string,
  taskTitle: string,
  reason: string,
  completionId: string
) {
  await Promise.all([
    createNotification({
      userId,
      type: "task_rejected",
      title: "Task Rejected",
      message: `Your completion of "${taskTitle}" was rejected. Reason: ${reason}`,
      refId: completionId,
    }),
    sendEmail({
      to: email,
      subject: "Task Submission Rejected",
      html: `<p>Your submission for <strong>${taskTitle}</strong> was rejected.</p><p><strong>Reason:</strong> ${reason}</p>`,
    }),
  ]);
}

/** Email user when their bank-transfer registration is approved */
export async function notifyVerificationApproved(
  email: string,
  fullName: string,
  appUrl: string
) {
  await sendEmail({
    to: email,
    subject: "Your BountyTask account has been activated 🎉",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#16a34a">Account Activated!</h2>
        <p>Hi ${fullName},</p>
        <p>
          Your registration payment has been verified and your BountyTask account
          is now active. We also credited your <strong>₦200 signup bonus</strong>.
        </p>
        <p>Click the button below to set your password and start earning:</p>
        <a href="${appUrl}/forgot-password"
           style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Set My Password &amp; Sign In →
        </a>
        <p style="color:#6b7280;font-size:13px">
          Enter your email address on the password-reset page and we'll send you
          a secure link to create your password.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">BountyTask Nigeria · You're receiving this because you registered at bountytask.com</p>
      </div>
    `,
  })
}

/** Email user when their bank-transfer registration is rejected */
export async function notifyVerificationRejected(
  email: string,
  fullName: string,
  reason: string | null
) {
  await sendEmail({
    to: email,
    subject: "BountyTask registration request — not approved",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#dc2626">Registration Not Approved</h2>
        <p>Hi ${fullName},</p>
        <p>
          Unfortunately we could not verify your payment and your registration
          request has been declined.
        </p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>
          If you believe this is a mistake, please reply to this email with your
          proof of payment and we'll review it again.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">BountyTask Nigeria</p>
      </div>
    `,
  })
}

/** Notify withdrawal status change */
export async function notifyWithdrawalUpdate(
  userId: string,
  email: string,
  amountKobo: number,
  status: "approved" | "rejected",
  reason?: string,
  withdrawalId?: string
) {
  const naira = (amountKobo / 100).toFixed(2);
  const approved = status === "approved";
  await Promise.all([
    createNotification({
      userId,
      type: approved ? "withdrawal_approved" : "withdrawal_rejected",
      title: approved ? "Withdrawal Approved ✅" : "Withdrawal Rejected",
      message: approved
        ? `Your withdrawal of ₦${naira} has been approved and will be processed manually.`
        : `Your withdrawal of ₦${naira} was rejected. Reason: ${reason}`,
      refId: withdrawalId,
    }),
    sendEmail({
      to: email,
      subject: approved ? "Withdrawal Approved" : "Withdrawal Rejected",
      html: approved
        ? `<p>Your withdrawal of <strong>₦${naira}</strong> has been approved. You will receive your funds via bank transfer.</p>`
        : `<p>Your withdrawal of <strong>₦${naira}</strong> was rejected.</p><p><strong>Reason:</strong> ${reason}</p>`,
    }),
  ]);
}
