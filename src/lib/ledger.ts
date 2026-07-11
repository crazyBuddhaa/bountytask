import { createAdminClient } from "@/lib/supabase/admin";
import type { LedgerRef } from "@/types";

/**
 * Append a ledger entry and return the new entry.
 * This is the ONLY way credits/debits should be recorded.
 * Never mutate any balance field — balance is always calculated from this table.
 */
export async function appendLedger({
  userId,
  type,
  delta,
  refType,
  refId,
  note,
  createdBy,
}: {
  userId: string;
  type: "credit" | "debit";
  delta: number; // kobo. Positive for credit, negative for debit
  refType: LedgerRef;
  refId?: string;
  note?: string;
  createdBy?: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ledger")
    .insert({
      user_id: userId,
      type,
      delta: type === "debit" ? -Math.abs(delta) : Math.abs(delta),
      ref_type: refType,
      ref_id: refId ?? null,
      note: note ?? null,
      created_by: createdBy ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Ledger append failed: ${error.message}`);
  return data;
}

/**
 * Calculate a user's live balance from the ledger (read-only).
 * This is always the authoritative balance.
 */
export async function getLiveBalance(userId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_user_balance", {
    p_user_id: userId,
  });

  if (error) throw new Error(`Balance calculation failed: ${error.message}`);
  return (data as number) ?? 0;
}

/**
 * Get paginated ledger history for a user.
 */
export async function getLedgerHistory(
  userId: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {}
) {
  const supabase = createAdminClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("ledger")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { entries: data ?? [], total: count ?? 0 };
}

/**
 * Ensure the user has sufficient balance before a debit.
 * Throws if insufficient.
 */
export async function assertSufficientBalance(
  userId: string,
  amount: number
): Promise<void> {
  const balance = await getLiveBalance(userId);
  if (balance < amount) {
    throw new Error(
      `Insufficient balance. Available: ₦${(balance / 100).toFixed(2)}, Required: ₦${(amount / 100).toFixed(2)}`
    );
  }
}
