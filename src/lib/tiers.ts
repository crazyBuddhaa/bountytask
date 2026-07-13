import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tier } from "@/types";

/** All 6 tiers, ordered lowest to highest. Cached for 5 minutes — changes rarely. */
export const getAllTiers = unstable_cache(
  async (): Promise<Tier[]> => {
    const admin = createAdminClient();
    const { data } = await admin.from("tiers").select("*").order("id", { ascending: true });
    return data ?? [];
  },
  ["all-tiers"],
  { revalidate: 300, tags: ["tiers"] }
);

/**
 * Total approved task completions for a user (all-time, not just today).
 */
export async function getTotalApprovedCompletions(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("task_completions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "approved");
  return count ?? 0;
}

/**
 * Total completed ad/offer-wall tasks for a user (all-time, all providers).
 * Every row in ad_task_logs is already a confirmed, credited completion —
 * there is no pending/approved state for ads, unlike regular task_completions.
 */
export async function getTotalAdCompletions(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("ad_task_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

/**
 * Combined completion count used for tier advancement: regular approved task
 * completions PLUS completed ad/offer-wall tasks. Ads count the same as
 * regular tasks toward the "min_completions" tier threshold.
 */
export async function getTotalCompletionsForTier(userId: string): Promise<number> {
  const [taskCompletions, adCompletions] = await Promise.all([
    getTotalApprovedCompletions(userId),
    getTotalAdCompletions(userId),
  ]);
  return taskCompletions + adCompletions;
}

/**
 * Highest tier the user qualifies for.
 * A user reaches a tier by meeting EITHER the referral threshold OR the
 * task-completion threshold — whichever path they hit first promotes them.
 */
export function pickTierForUser(
  tiers: Tier[],
  referralCount: number,
  completionCount: number
): Tier | null {
  const eligible = tiers.filter(
    (t) => referralCount >= t.min_referrals || completionCount >= t.min_completions
  );
  if (eligible.length === 0) return tiers[0] ?? null;
  return eligible.reduce((best, t) => (t.id > best.id ? t : best));
}

/**
 * Recalculate and persist a user's tier from their current referral count
 * AND their total approved task completions.
 * Only ever raises the tier — never automatically downgrades a tier an admin
 * manually set to a higher value.
 */
export async function recalcUserTier(userId: string): Promise<number> {
  const admin = createAdminClient();

  const [{ count: referralCount }, completionCount, tiers, { data: current }] = await Promise.all([
    admin.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
    getTotalCompletionsForTier(userId),
    getAllTiers(),
    admin.from("users").select("tier").eq("id", userId).single(),
  ]);

  const earned = pickTierForUser(tiers, referralCount ?? 0, completionCount);
  const currentTier = current?.tier ?? 1;
  if (!earned) return currentTier;

  const newTier = Math.max(earned.id, currentTier);
  if (newTier !== currentTier) {
    await admin.from("users").update({ tier: newTier }).eq("id", userId);
  }
  return newTier;
}

/** Number of regular tasks a user has completed (approved) since UTC midnight today. */
export async function getTasksCompletedToday(userId: string): Promise<number> {
  const admin = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count } = await admin
    .from("task_completions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "approved")
    .gte("created_at", startOfDay.toISOString());

  return count ?? 0;
}

/** Number of ad/offer-wall tasks (any provider) a user has completed since UTC midnight today. */
export async function getAdCompletionsToday(userId: string): Promise<number> {
  const admin = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count } = await admin
    .from("ad_task_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("completed_at", startOfDay.toISOString());

  return count ?? 0;
}

/**
 * Combined completions today: regular tasks + ad/offer-wall tasks (all
 * providers). This is the number the tier's daily_task_limit is enforced
 * against — ads count against the same platform-wide daily budget, on top
 * of whatever cap each individual ad provider already applies.
 */
export async function getTotalCompletionsToday(userId: string): Promise<number> {
  const [tasks, ads] = await Promise.all([
    getTasksCompletedToday(userId),
    getAdCompletionsToday(userId),
  ]);
  return tasks + ads;
}

/**
 * Whether a user has hit their tier's daily task-completion limit.
 * Counts BOTH regular task completions and ad/offer-wall completions —
 * ads and tasks draw from the same daily budget. Each ad provider also
 * enforces its own separate `*_daily_cap` on top of this (see
 * `checkAdDailyCap` in `ad-providers.ts`); a completion must clear both
 * limits.
 */
export async function checkDailyTaskLimit(
  userId: string
): Promise<{ limited: boolean; used: number; limit: number }> {
  const admin = createAdminClient();
  const [{ data: profile }, used] = await Promise.all([
    admin.from("users").select("tier").eq("id", userId).single(),
    getTotalCompletionsToday(userId),
  ]);

  const { data: tier } = await admin
    .from("tiers")
    .select("daily_task_limit")
    .eq("id", profile?.tier ?? 1)
    .single();

  const limit = tier?.daily_task_limit ?? 10;
  return { limited: used >= limit, used, limit };
}

/**
 * Full tier snapshot for a user: current tier, referral count, total approved
 * completions, next tier thresholds, and today's combined (tasks + ads) usage.
 */
export async function getUserTierStatus(userId: string) {
  const admin = createAdminClient();
  const [tiers, { count: referralCount }, { data: profile }, tasksCompletedToday, totalCompletions] =
    await Promise.all([
      getAllTiers(),
      admin.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", userId),
      admin.from("users").select("tier").eq("id", userId).single(),
      getTotalCompletionsToday(userId),
      getTotalCompletionsForTier(userId),
    ]);

  const currentTierId = profile?.tier ?? 1;
  const currentTier = tiers.find((t) => t.id === currentTierId) ?? tiers[0] ?? null;
  const nextTier = tiers.find((t) => t.id === currentTierId + 1) ?? null;

  return {
    tiers,
    currentTier,
    nextTier,
    referralCount: referralCount ?? 0,
    totalCompletions,
    tasksCompletedToday,
    dailyLimit: currentTier?.daily_task_limit ?? 10,
  };
}
