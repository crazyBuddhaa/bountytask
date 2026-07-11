import { createAdminClient } from "@/lib/supabase/admin";

/** Append an immutable audit log entry */
export async function auditLog({
  actorId,
  action,
  targetType,
  targetId,
  details,
  ipAddress,
}: {
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  const supabase = createAdminClient();
  await supabase.from("audit_logs").insert({
    actor_id: actorId ?? null,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    details: details ?? null,
    ip_address: ipAddress ?? null,
  });
}
