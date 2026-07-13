-- ─── Performance indexes ──────────────────────────────────────────────────────

-- task_completions: getTasksCompletedToday() + getTotalApprovedCompletions()
-- both filter on (user_id, status) and order/filter by created_at.
-- Without this, every tier check and daily-limit check does a full table scan.
CREATE INDEX IF NOT EXISTS idx_completions_user_status_created
  ON task_completions(user_id, status, created_at DESC);

-- platform_settings: getVerificationSettings() + getAdvertiserSettings() run
-- an IN filter on `key` on every layout load. Without this they scan the table.
CREATE INDEX IF NOT EXISTS idx_platform_settings_key
  ON platform_settings(key);

-- users: tier-based queries and admin filtering
CREATE INDEX IF NOT EXISTS idx_users_tier
  ON users(tier);

-- ─── Data integrity: one active withdrawal per user ───────────────────────────
-- Enforces at the DB level what the app currently only checks at the app level.
-- If two concurrent withdrawal requests both pass the app-level pending check,
-- only one will succeed the DB insert — the other gets a 23505 unique violation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_one_active_per_user
  ON withdrawals(user_id)
  WHERE status IN ('pending', 'under_review');

-- ─── Atomic balance check + debit ─────────────────────────────────────────────
-- Replaces the check-then-act pattern (assertSufficientBalance → appendLedger)
-- in the withdrawal flow. Uses a per-user advisory lock so concurrent requests
-- are serialized — only one can hold the lock at a time, eliminating overdrafts.
CREATE OR REPLACE FUNCTION safe_withdrawal_debit(
  p_user_id  UUID,
  p_amount   BIGINT,
  p_note     TEXT
) RETURNS TABLE(ok BOOLEAN, ledger_id UUID, err TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance BIGINT;
  v_id      UUID;
BEGIN
  -- Serialize concurrent withdrawal requests for this user.
  -- pg_advisory_xact_lock is released automatically at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  SELECT COALESCE(SUM(delta), 0) INTO v_balance
  FROM ledger WHERE user_id = p_user_id;

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      format(
        'Insufficient balance. Available: ₦%s, Required: ₦%s',
        round((v_balance / 100.0)::numeric, 2),
        round((p_amount  / 100.0)::numeric, 2)
      );
    RETURN;
  END IF;

  INSERT INTO ledger(user_id, type, delta, ref_type, note)
  VALUES(p_user_id, 'debit', -p_amount, 'withdrawal_debit', p_note)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_id, NULL::TEXT;
END;
$$;
