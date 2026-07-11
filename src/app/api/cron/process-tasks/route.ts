import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: expiredTasks, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title")
    .in("status", ["active", "paused"])
    .not("expires_at", "is", null)
    .lt("expires_at", now);

  if (fetchError) {
    return NextResponse.json(
      { error: `Failed to fetch expired tasks: ${fetchError.message}` },
      { status: 500 }
    );
  }

  if (!expiredTasks || expiredTasks.length === 0) {
    return NextResponse.json({ processed: 0, message: "No expired tasks." });
  }

  const ids = expiredTasks.map((t) => t.id);

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: "completed", updated_at: now })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to archive expired tasks: ${updateError.message}` },
      { status: 500 }
    );
  }

  const supabaseAdmin = createAdminClient();
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: null,
    action: "cron.process_expired_tasks",
    target_type: "task",
    target_id: null,
    details: { count: ids.length, task_ids: ids },
    ip_address: null,
  });

  return NextResponse.json({
    processed: ids.length,
    tasks: expiredTasks.map((t) => ({ id: t.id, title: t.title })),
  });
}
