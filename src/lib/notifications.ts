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

/** Email user when their withdrawal-verification bank transfer is approved */
export async function notifyVerificationApproved(
  email: string,
  fullName: string
) {
  await sendEmail({
    to: email,
    subject: "You're verified — withdrawals are now unlocked 🎉",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#16a34a">Verification Approved!</h2>
        <p>Hi ${fullName},</p>
        <p>
          Your bank transfer has been verified. You can now request withdrawals
          from your BountyTask balance.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">BountyTask Nigeria</p>
      </div>
    `,
  })
}

/** Email user when their withdrawal-verification bank transfer is rejected */
export async function notifyVerificationRejected(
  email: string,
  fullName: string,
  reason: string | null
) {
  await sendEmail({
    to: email,
    subject: "BountyTask verification request — not approved",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#dc2626">Verification Not Approved</h2>
        <p>Hi ${fullName},</p>
        <p>
          Unfortunately we could not verify your payment, so your withdrawal
          verification request has been declined.
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
