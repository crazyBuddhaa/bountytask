-- ============================================================
-- BountyTask — Ad-Blocker Detection, Warnings & Penalties
-- ============================================================

-- 1. Log table for ad-blocker detection strikes
CREATE TABLE IF NOT EXISTS public.adblock_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  page_path           TEXT,
  action              TEXT        NOT NULL CHECK (action IN ('warning', 'penalty')),
  penalty_kobo        BIGINT      NOT NULL DEFAULT 0 CHECK (penalty_kobo >= 0),
  ledger_entry_id     UUID        REFERENCES public.ledger(id) ON DELETE SET NULL,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adblock_events_user_date
  ON public.adblock_events(user_id, detected_at DESC);

ALTER TABLE public.adblock_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own adblock events" ON public.adblock_events;
CREATE POLICY "Users can view own adblock events"
  ON public.adblock_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all adblock events" ON public.adblock_events;
CREATE POLICY "Admins can view all adblock events"
  ON public.adblock_events FOR SELECT
  USING (public.is_admin());

-- 2. Atomic penalty debit RPC (capped at user's balance so balance never goes negative)
CREATE OR REPLACE FUNCTION public.safe_adblock_penalty_debit(
  p_user_id      UUID,
  p_penalty_kobo BIGINT,
  p_note         TEXT
) RETURNS TABLE(debited_kobo BIGINT, ledger_id UUID, new_balance_kobo BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance   BIGINT;
  v_debit     BIGINT;
  v_ledger_id UUID;
BEGIN
  IF p_penalty_kobo IS NULL OR p_penalty_kobo <= 0 THEN
    RETURN QUERY SELECT 0::BIGINT, NULL::UUID, 0::BIGINT;
    RETURN;
  END IF;

  SELECT balance_kobo INTO v_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance <= 0 THEN
    RETURN QUERY SELECT 0::BIGINT, NULL::UUID, COALESCE(v_balance, 0)::BIGINT;
    RETURN;
  END IF;

  v_debit := LEAST(v_balance, p_penalty_kobo);

  INSERT INTO public.ledger(user_id, type, delta, ref_type, note)
  VALUES(p_user_id, 'debit', -v_debit, 'penalty', p_note)
  RETURNING id INTO v_ledger_id;

  RETURN QUERY SELECT v_debit, v_ledger_id, (v_balance - v_debit);
END;
$$;

REVOKE ALL ON FUNCTION public.safe_adblock_penalty_debit(UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.safe_adblock_penalty_debit(UUID, BIGINT, TEXT) TO service_role;

-- 3. Platform settings seeds
INSERT INTO public.platform_settings (key, value) VALUES
  ('adblock_detector_enabled',  'true'),
  ('adblock_warning_threshold', '2'),
  ('adblock_penalty_kobo',      '5000')
ON CONFLICT (key) DO NOTHING;
