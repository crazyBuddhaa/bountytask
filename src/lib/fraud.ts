import { createAdminClient } from "@/lib/supabase/admin";
import type { FraudSeverity } from "@/types";

/** Flag a user for suspicious activity */
export async function flagUser({
  userId,
  reason,
  severity,
  details,
}: {
  userId: string;
  reason: string;
  severity: FraudSeverity;
  details?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  await supabase.from("fraud_flags").insert({
    user_id: userId,
    reason,
    severity,
    details: details ?? null,
    resolved: false,
  });
}

/** Check if a device fingerprint is linked to multiple accounts */
export async function checkDeviceConflict(
  fingerprint: string,
  currentUserId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("devices")
    .select("user_id")
    .eq("fingerprint", fingerprint)
    .neq("user_id", currentUserId)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/** Upsert device record */
export async function recordDevice({
  userId,
  fingerprint,
  ipAddress,
  userAgent,
}: {
  userId: string;
  fingerprint: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Try upsert by fingerprint + user combo
  const { data: existing } = await supabase
    .from("devices")
    .select("id")
    .eq("user_id", userId)
    .eq("fingerprint", fingerprint)
    .single();

  if (existing) {
    await supabase
      .from("devices")
      .update({ last_seen_at: now, ip_address: ipAddress ?? null })
      .eq("id", existing.id);
  } else {
    await supabase.from("devices").insert({
      user_id: userId,
      fingerprint,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
      first_seen_at: now,
      last_seen_at: now,
    });
  }
}

/** Check for rapid task completions (rate limiting) */
export async function checkTaskCompletionRate(
  userId: string,
  windowMinutes = 60,
  maxCompletions = 10
): Promise<boolean> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("task_completions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  return (count ?? 0) >= maxCompletions;
}

/** Check if user already completed a specific task */
export async function hasCompletedTask(
  userId: string,
  taskId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("task_completions")
    .select("id")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .in("status", ["pending", "approved"])
    .limit(1);

  return (data?.length ?? 0) > 0;
}
