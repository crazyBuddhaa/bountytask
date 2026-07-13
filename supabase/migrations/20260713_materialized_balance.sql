-- ─── Materialized balance column ──────────────────────────────────────────────
--
-- Problem: get_user_balance() does SELECT SUM(delta) FROM ledger WHERE user_id = $1
-- That is O(n) per call. Every balance read on every page load, withdrawal attempt,
-- and admin list row triggers a full aggregate over the ledger.
--
-- Fix: add users.balance_kobo — a running total maintained by a BEFORE INSERT trigger
-- on the ledger table. Balance reads become a single-row O(1) column lookup.
-- The trigger fires inside the same transaction as every appendLedger() call, so
-- balance_kobo is always exactly consistent with the ledger — no drift possible.
--
-- Steps:
--   1. Add column (default 0 so the ALTER is safe on live data)
--   2. Backfill from existing ledger data (once, before trigger is created)
--   3. Create trigger function + trigger
--   4. Rewrite get_user_balance() to read from the column — callers unchanged
--   5. Rewrite safe_withdrawal_debit() to use SELECT FOR UPDATE (locks the user
--      row, serialising concurrent withdrawals without a global advisory lock)

-- 1. Add materialized balance column
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS balance_kobo BIGINT NOT NULL DEFAULT 0;

-- 2. Backfill from current ledger state.
--    Must run BEFORE the trigger is created to avoid double-counting.
UPDATE public.users u
SET balance_kobo = COALESCE(
  (SELECT SUM(delta) FROM public.ledger WHERE user_id = u.id),
  0
);

-- 3a. Trigger function — fires on every ledger INSERT, increments/decrements user balance
CREATE OR REPLACE FUNCTION public.sync_user_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET balance_kobo = balance_kobo + NEW.delta
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- 3b. Attach trigger (idempotent via DROP IF EXISTS)
DROP TRIGGER IF EXISTS trg_sync_user_balance ON public.ledger;
CREATE TRIGGER trg_sync_user_balance
  AFTER INSERT ON public.ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_balance();

-- 4. Rewrite get_user_balance — same signature, callers (getLiveBalance in TS) unchanged.
--    Was: SELECT COALESCE(SUM(delta),0) FROM ledger WHERE user_id = p_user_id  [O(n)]
--    Now: SELECT balance_kobo FROM users WHERE id = p_user_id                  [O(1)]
CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(balance_kobo, 0) FROM public.users WHERE id = p_user_id;
$$;

-- 5. Rewrite safe_withdrawal_debit — swap advisory lock for SELECT FOR UPDATE.
--    SELECT FOR UPDATE locks exactly the user row, serialising concurrent withdrawals
--    for the same user. The trigger then updates balance_kobo when the ledger row is
--    inserted — all inside the same transaction, so the lock is held until commit.
CREATE OR REPLACE FUNCTION public.safe_withdrawal_debit(
  p_user_id UUID,
  p_amount  BIGINT,
  p_note    TEXT
) RETURNS TABLE(ok BOOLEAN, ledger_id UUID, err TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
  v_id      UUID;
BEGIN
  -- Lock the user row so concurrent calls for the same user queue up here.
  SELECT balance_kobo INTO v_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'User not found'::TEXT;
    RETURN;
  END IF;

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      format(
        'Insufficient balance. Available: ₦%s, Required: ₦%s',
        round((v_balance / 100.0)::numeric, 2),
        round((p_amount  / 100.0)::numeric, 2)
      )::TEXT;
    RETURN;
  END IF;

  -- Insert debit. The trigger updates users.balance_kobo within this transaction.
  INSERT INTO public.ledger(user_id, type, delta, ref_type, note)
  VALUES(p_user_id, 'debit', -p_amount, 'withdrawal_debit', p_note)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_id, NULL::TEXT;
END;
$$;
