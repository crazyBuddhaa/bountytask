import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/types";
import {
  welcomeEmail,
  taskApprovedEmail,
  taskRejectedEmail,
  withdrawalApprovedEmail,
  withdrawalRejectedEmail,
  verificationApprovedEmail,
  verificationRejectedEmail,
  adminBroadcastEmail,
  loginReminderEmail,
} from "@/lib/emails";

// ─────────────────────────────────────────────────────────────────────────────
// In-app notification
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Email delivery (Resend)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) return; // email is optional in dev

  const from =
    `BountyTask <noreply@${
      process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, "") ??
      "bountytask.dpdns.org"
    }>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Email send failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Welcome (sent once after email confirmation / first login)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, name: string) {
  await sendEmail({
    to: email,
    subject: "Welcome to BountyTask — start earning Naira today 🎉",
    html: welcomeEmail(name),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task approved
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyTaskApproved(
  userId: string,
  email: string,
  taskTitle: string,
  rewardKobo: number,
  completionId: string,
  newBalanceKobo?: number
) {
  const rewardNaira  = (rewardKobo / 100).toFixed(2);
  const balanceNaira = newBalanceKobo != null
    ? (newBalanceKobo / 100).toFixed(2)
    : "—";

  await Promise.all([
    createNotification({
      userId,
      type: "task_approved",
      title: "Task Approved! 🎉",
      message: `Your completion of "${taskTitle}" was approved. ₦${rewardNaira} has been credited to your account.`,
      refId: completionId,
    }),
    sendEmail({
      to: email,
      subject: `Task Approved — ₦${rewardNaira} credited`,
      html: taskApprovedEmail("there", taskTitle, rewardNaira, balanceNaira),
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task rejected
// ─────────────────────────────────────────────────────────────────────────────

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
      subject: `Task Submission Rejected — ${taskTitle}`,
      html: taskRejectedEmail("there", taskTitle, reason),
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bank verification approved
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyVerificationApproved(
  email: string,
  fullName: string
) {
  await sendEmail({
    to: email,
    subject: "You're verified — withdrawals are now unlocked 🎉",
    html: verificationApprovedEmail(fullName),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bank verification rejected
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyVerificationRejected(
  email: string,
  fullName: string,
  reason: string | null
) {
  await sendEmail({
    to: email,
    subject: "BountyTask verification — action needed",
    html: verificationRejectedEmail(fullName, reason),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin broadcast
// ─────────────────────────────────────────────────────────────────────────────

export type BroadcastChannel = "in_app" | "email";

export async function sendAdminNotification({
  target,
  userId,
  title,
  message,
  channels,
}: {
  target: "all" | "user";
  userId?: string;
  title: string;
  message: string;
  channels: BroadcastChannel[];
}): Promise<{ recipientCount: number }> {
  const admin = createAdminClient();

  let recipients: { id: string; email: string }[] = [];
  if (target === "user") {
    if (!userId) throw new Error("userId is required when target is 'user'");
    const { data } = await admin
      .from("users")
      .select("id, email")
      .eq("id", userId)
      .single();
    if (!data) throw new Error("User not found");
    recipients = [data];
  } else {
    const { data } = await admin
      .from("users")
      .select("id, email")
      .eq("is_active", true);
    recipients = data ?? [];
  }

  const wantsInApp = channels.includes("in_app");
  const wantsEmail = channels.includes("email");

  if (wantsInApp && recipients.length > 0) {
    const rows = recipients.map((r) => ({
      user_id: r.id,
      type: "admin_broadcast" as const,
      title,
      message,
      read: false,
    }));
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await admin.from("notifications").insert(rows.slice(i, i + BATCH));
    }
  }

  if (wantsEmail) {
    const html = adminBroadcastEmail(title, message);
    const BATCH = 20;
    for (let i = 0; i < recipients.length; i += BATCH) {
      await Promise.all(
        recipients
          .slice(i, i + BATCH)
          .map((r) => sendEmail({ to: r.email, subject: title, html }))
      );
    }
  }

  return { recipientCount: recipients.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal status
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyWithdrawalUpdate(
  userId: string,
  email: string,
  amountKobo: number,
  status: "approved" | "rejected",
  reason?: string,
  withdrawalId?: string
) {
  const naira    = (amountKobo / 100).toFixed(2);
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
      subject: approved
        ? `Withdrawal Approved — ₦${naira} on the way`
        : `Withdrawal Update — ₦${naira}`,
      html: approved
        ? withdrawalApprovedEmail("there", naira)
        : withdrawalRejectedEmail("there", naira, reason),
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Login / re-engagement reminder
// ─────────────────────────────────────────────────────────────────────────────

export async function sendLoginReminderEmail(
  email: string,
  name: string,
  balanceKobo: number
) {
  const balanceNaira = (balanceKobo / 100).toFixed(2);
  await sendEmail({
    to: email,
    subject: `${name}, new tasks are waiting for you on BountyTask`,
    html: loginReminderEmail(name, balanceNaira),
  });
}
