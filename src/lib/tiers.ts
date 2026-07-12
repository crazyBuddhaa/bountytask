import { createAdminClient } from "@/lib/supabase/admin";
import type { Tier } from "@/types";

/** All 6 tiers, ordered lowest to highest. */
export async function getAllTiers(): Promise<Tier[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("tiers").select("*").order("id", { ascending: true });
  return data ?? [];
}

/** Highest tier whose min_referrals threshold the given count satisfies. */
export function pickTierForCount(tiers: Tier[], referralCount: number): Tier | null {
  const eligible = tiers.filter((t) => referralCount >= t.min_referrals);
  if (eligible.length === 0) return tiers[0] ?? null;
  return eligible.reduce((best, t) => (t.min_referrals > best.min_referrals ? t : best));
}

/**
 * Recalculate and persist a user's tier from their current referral count.
 * Called whenever a new referral is recorded. Only ever raises the tier —
 * never automatically downgrades a tier an admin manually raised.
 */
export async function recalcUserTier(userId: string): Promise<number> {
  const admin = createAdminClient();

  const [{ count }, tiers, { data: current }] = await Promise.all([
    admin.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
    getAllTiers(),
    admin.from("users").select("tier").eq("id", userId).single(),
  ]);

  const earned = pickTierForCount(tiers, count ?? 0);
  const currentTier = current?.tier ?? 1;
  if (!earned) return currentTier;

  const newTier = Math.max(earned.id, currentTier);
  if (newTier !== currentTier) {
    await admin.from("users").update({ tier: newTier }).eq("id", userId);
  }
  return newTier;
}

/** Number of tasks a user has completed (submitted) since UTC midnight today. */
export async function getTasksCompletedToday(userId: string): Promise<number> {
  const admin = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count } = await admin
    .from("task_completions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());

  return count ?? 0;
}

/** Whether a user has hit their tier's daily task-completion limit. */
export async function checkDailyTaskLimit(
  userId: string
): Promise<{ limited: boolean; used: number; limit: number }> {
  const admin = createAdminClient();
  const [{ data: profile }, used] = await Promise.all([
    admin.from("users").select("tier").eq("id", userId).single(),
    getTasksCompletedToday(userId),
  ]);

  const { data: tier } = await admin
    .from("tiers")
    .select("daily_task_limit")
    .eq("id", profile?.tier ?? 1)
    .single();

  const limit = tier?.daily_task_limit ?? 10;
  return { limited: used >= limit, used, limit };
}

/** Full tier snapshot for a user: current tier, referral count, next tier, and today's usage. */
export async function getUserTierStatus(userId: string) {
  const admin = createAdminClient();
  const [tiers, { count: referralCount }, { data: profile }, tasksCompletedToday] = await Promise.all([
    getAllTiers(),
    admin.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
    admin.from("users").select("tier").eq("id", userId).single(),
    getTasksCompletedToday(userId),
  ]);

  const currentTierId = profile?.tier ?? 1;
  const currentTier = tiers.find((t) => t.id === currentTierId) ?? tiers[0] ?? null;
  const nextTier = tiers.find((t) => t.id === currentTierId + 1) ?? null;

  return {
    tiers,
    currentTier,
    nextTier,
    referralCount: referralCount ?? 0,
    tasksCompletedToday,
    dailyLimit: currentTier?.daily_task_limit ?? 10,
  };
}
