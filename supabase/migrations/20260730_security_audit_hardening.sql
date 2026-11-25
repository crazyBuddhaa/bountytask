-- ============================================================
-- BountyTask — Security & Financial Integrity Hardening Migration
-- ============================================================
-- Addresses all database, RLS, SECURITY DEFINER RPC, constraint,
-- and concurrency/atomicity findings from the security audit.
--
-- Safe to run on existing production data:
--   - All DDL uses IF EXISTS / IF NOT EXISTS / CREATE OR REPLACE
--   - New CHECK constraints use NOT VALID so existing rows never block
--     the migration while all new writes are strictly enforced.
-- ============================================================

-- ─── 1. Lock down RLS: drop permissive client-side write policies ─────────────
-- All application mutations go through server-side Next.js API routes
-- using createAdminClient() (service_role). Client PostgREST sessions
-- only need SELECT access (where applicable).

-- 1a. public.users: block direct client UPDATE (prevents balance_kobo / kyc_verified /
--     phone_verified / tier / is_active / full_name_locked tampering)
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- 1b. public.withdrawals: block direct client INSERT (prevents debit/KYC bypass)
DROP POLICY IF EXISTS "Authenticated users can request withdrawals" ON public.withdrawals;

-- 1c. public.withdrawal_accounts: replace FOR ALL with SELECT-only
DROP POLICY IF EXISTS "Users manage own accounts" ON public.withdrawal_accounts;
DROP POLICY IF EXISTS "Users see own accounts" ON public.withdrawal_accounts;
CREATE POLICY "Users see own accounts"
  ON public.withdrawal_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- 1d. public.task_completions: block direct client INSERT (prevents status='approved' forgery)
DROP POLICY IF EXISTS "Authenticated users can insert completions" ON public.task_completions;

-- 1e. public.video_watch_sessions: replace FOR ALL with SELECT-only
DROP POLICY IF EXISTS "video_watch_sessions_own" ON public.video_watch_sessions;
DROP POLICY IF EXISTS "Users can read own video watch sessions" ON public.video_watch_sessions;
CREATE POLICY "Users can read own video watch sessions"
  ON public.video_watch_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- 1f. public.game_sessions: block direct client INSERT (prevents score forgery)
DROP POLICY IF EXISTS "Users can insert own game sessions" ON public.game_sessions;

-- 1g. public.news_reads: block direct client INSERT
DROP POLICY IF EXISTS "Users can insert own reads" ON public.news_reads;

-- 1h. storage.objects: prevent users from deleting submitted task proofs
DROP POLICY IF EXISTS "Users can delete own proofs" ON storage.objects;

-- ─── 2. Protect users.balance_kobo from direct mutation ───────────────────────
-- Only sync_user_balance() (triggered by INSERT on public.ledger) may modify balance_kobo.

CREATE OR REPLACE FUNCTION public.sync_user_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.ledger_sync', 'on', true);
  UPDATE public.users
  SET balance_kobo = balance_kobo + NEW.delta
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_user_balance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.balance_kobo IS DISTINCT FROM OLD.balance_kobo
     AND current_setting('app.ledger_sync', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'users.balance_kobo is ledger-derived and cannot be updated directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_balance_update ON public.users;
CREATE TRIGGER trg_guard_user_balance_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_balance_update();

-- ─── 3. Financial & Idempotency Constraints / Indexes ─────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_delta_sign_check'
  ) THEN
    ALTER TABLE public.ledger
      ADD CONSTRAINT ledger_delta_sign_check
      CHECK ((type = 'credit' AND delta > 0) OR (type = 'debit' AND delta < 0))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_balance_non_negative'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_balance_non_negative
      CHECK (balance_kobo >= 0)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_ledger_entry_not_null'
  ) THEN
    ALTER TABLE public.withdrawals
      ADD CONSTRAINT withdrawals_ledger_entry_not_null
      CHECK (ledger_entry_id IS NOT NULL)
      NOT VALID;
  END IF;
END $$;

-- Partial unique indexes preventing duplicate credits even under concurrency
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_signup_bonus_per_user
  ON public.ledger(user_id)
  WHERE ref_type = 'signup_bonus';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_withdrawal_reversal
  ON public.ledger(ref_id)
  WHERE ref_type = 'withdrawal_reversal' AND ref_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_referral_bonus
  ON public.ledger(ref_id)
  WHERE ref_type = 'referral_bonus' AND ref_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_task_reward
  ON public.ledger(ref_id)
  WHERE ref_type = 'task_reward' AND ref_id IS NOT NULL;

-- Verified phone uniqueness across accounts (prevents Sybil phone reuse)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_verified_phone
  ON public.users(phone)
  WHERE phone_verified = true AND phone IS NOT NULL;

-- ─── 4. Global Paystack Reference Deduplication Table ─────────────────────────
-- Single cross-flow table preventing a verification payment reference from being
-- replayed as an advertiser payment (or vice versa).

CREATE TABLE IF NOT EXISTS public.paystack_consumed_references (
  reference   TEXT        PRIMARY KEY,
  purpose     TEXT        NOT NULL CHECK (purpose IN ('withdrawal_verification_fee', 'advertiser_submission_fee')),
  entity_id   TEXT        NOT NULL,
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  amount_kobo BIGINT      NOT NULL CHECK (amount_kobo > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.paystack_consumed_references ENABLE ROW LEVEL SECURITY;
-- No client-facing policies: service_role only.

-- ─── 5. Game Entry Tokens (Anti-Cheat / Entry-Fee Binding) ────────────────────
-- Every paid or tracked game session must consume a single-use token issued by
-- POST /api/games/enter (or free-play start when entry fees are disabled).

CREATE TABLE IF NOT EXISTS public.game_entry_tokens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_slug      TEXT        NOT NULL CHECK (game_slug IN (
                   'wordle','higher-or-lower','tap-target','2048','color-rush','word-scramble'
                 )),
  entry_fee_kobo INTEGER     NOT NULL DEFAULT 0 CHECK (entry_fee_kobo >= 0),
  ledger_id      UUID        REFERENCES public.ledger(id) ON DELETE SET NULL,
  week_start     DATE        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_game_entry_tokens_user_slug
  ON public.game_entry_tokens(user_id, game_slug, created_at DESC);

ALTER TABLE public.game_entry_tokens ENABLE ROW LEVEL SECURITY;
-- No client-facing policies: service_role only.

-- ─── 6. AI Verification Attempt Tracking & Proof Hash Deduplication ───────────

CREATE TABLE IF NOT EXISTS public.ai_verification_attempts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id     UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  verdict     TEXT        NOT NULL,
  confidence  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_verif_attempts_user_task
  ON public.ai_verification_attempts(user_id, task_id, created_at DESC);

ALTER TABLE public.ai_verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.proof_image_hashes (
  sha256     TEXT        PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id    UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.proof_image_hashes ENABLE ROW LEVEL SECURITY;

-- ─── 7. Fix weekly_leaderboard security_invoker (re-applied after 20260724) ───

CREATE OR REPLACE VIEW public.weekly_leaderboard
WITH (security_invoker = true) AS
SELECT
  gs.game_slug,
  gs.user_id,
  u.username,
  u.full_name,
  u.avatar_url,
  MAX(gs.score)       AS best_score,
  COUNT(*)            AS play_count,
  MAX(gs.played_at)   AS last_played_at
FROM public.game_sessions gs
JOIN public.users u ON u.id = gs.user_id
WHERE gs.played_at >= date_trunc('week', now())
  AND gs.completed = true
GROUP BY gs.game_slug, gs.user_id, u.username, u.full_name, u.avatar_url;

-- ─── 8. Harden Existing SECURITY DEFINER Functions ────────────────────────────

-- 8a. is_admin(): require is_active = true + SET search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
  );
$$;

-- 8b. increment_task_completions(): add SET search_path
CREATE OR REPLACE FUNCTION public.increment_task_completions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    UPDATE public.tasks
    SET current_completions = current_completions + 1
    WHERE id = NEW.task_id;

    UPDATE public.tasks
    SET status = 'completed'
    WHERE id = NEW.task_id
      AND max_completions IS NOT NULL
      AND current_completions >= max_completions;
  END IF;
  RETURN NEW;
END;
$$;

-- 8c. get_user_balance(): add SET search_path (service_role only)
CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(balance_kobo, 0) FROM public.users WHERE id = p_user_id;
$$;

-- 8d. get_platform_stats(): add SET search_path (service_role only)
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT json_build_object(
    'total_users',               (SELECT COUNT(*) FROM public.users WHERE role = 'user'),
    'active_users',              (SELECT COUNT(*) FROM public.users WHERE role = 'user' AND is_active = true),
    'total_tasks',               (SELECT COUNT(*) FROM public.tasks),
    'active_tasks',              (SELECT COUNT(*) FROM public.tasks WHERE status = 'active'),
    'total_completions',         (SELECT COUNT(*) FROM public.task_completions),
    'pending_completions',       (SELECT COUNT(*) FROM public.task_completions WHERE status = 'pending'),
    'total_withdrawn_kobo',      (SELECT COALESCE(SUM(amount), 0) FROM public.withdrawals WHERE status = 'paid'),
    'pending_withdrawals_kobo',  (SELECT COALESCE(SUM(amount), 0) FROM public.withdrawals WHERE status IN ('pending','under_review')),
    'total_fraud_flags',         (SELECT COUNT(*) FROM public.fraud_flags WHERE resolved = false),
    'total_ledger_credits_kobo', (SELECT COALESCE(SUM(delta), 0) FROM public.ledger WHERE type = 'credit')
  );
$$;

-- 8e. safe_withdrawal_debit(): add positive amount guard + SET search_path
CREATE OR REPLACE FUNCTION public.safe_withdrawal_debit(
  p_user_id UUID,
  p_amount  BIGINT,
  p_note    TEXT
) RETURNS TABLE(ok BOOLEAN, ledger_id UUID, err TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance BIGINT;
  v_id      UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Withdrawal amount must be positive'::TEXT;
    RETURN;
  END IF;

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

  INSERT INTO public.ledger(user_id, type, delta, ref_type, note)
  VALUES(p_user_id, 'debit', -p_amount, 'withdrawal_debit', p_note)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_id, NULL::TEXT;
END;
$$;

-- 8f. record_game_entry(): add positive fee guard + SET search_path
CREATE OR REPLACE FUNCTION public.record_game_entry(
  p_game_slug  TEXT,
  p_fee_kobo   INTEGER,
  p_week_start DATE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pool_id UUID;
  v_prize   BIGINT;
  v_cut     BIGINT;
BEGIN
  IF p_fee_kobo IS NULL OR p_fee_kobo <= 0 THEN
    RAISE EXCEPTION 'Entry fee must be positive';
  END IF;

  v_prize := floor(p_fee_kobo * 0.8);
  v_cut   := p_fee_kobo - v_prize;

  INSERT INTO public.game_prize_pools (game_slug, week_start, total_entries, total_collected_kobo, prize_pool_kobo, platform_cut_kobo)
  VALUES (p_game_slug, p_week_start, 1, p_fee_kobo, v_prize, v_cut)
  ON CONFLICT (game_slug, week_start) DO UPDATE
    SET total_entries        = game_prize_pools.total_entries + 1,
        total_collected_kobo = game_prize_pools.total_collected_kobo + p_fee_kobo,
        prize_pool_kobo      = game_prize_pools.prize_pool_kobo + v_prize,
        platform_cut_kobo    = game_prize_pools.platform_cut_kobo + v_cut
  RETURNING id INTO v_pool_id;

  RETURN v_pool_id;
END;
$$;

-- ─── 9. New Atomic Server-Only RPCs (Fix Concurrency & TOCTOU Races) ─────────

-- 9a. Atomic withdrawal request: pending-check + FOR UPDATE debit + withdrawal insert
CREATE OR REPLACE FUNCTION public.safe_withdrawal_request(
  p_user_id    UUID,
  p_account_id UUID,
  p_amount     BIGINT,
  p_note       TEXT
) RETURNS TABLE(ok BOOLEAN, withdrawal_id UUID, ledger_id UUID, err TEXT, err_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance       BIGINT;
  v_pending_count INTEGER;
  v_ledger_id     UUID;
  v_withdrawal_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Withdrawal amount must be positive'::TEXT, 'invalid_amount'::TEXT;
    RETURN;
  END IF;

  SELECT balance_kobo INTO v_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'User not found'::TEXT, 'not_found'::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.withdrawals
  WHERE user_id = p_user_id
    AND status IN ('pending', 'under_review');

  IF v_pending_count > 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID,
      'You already have a pending withdrawal request. Wait for it to be processed.'::TEXT,
      'pending_exists'::TEXT;
    RETURN;
  END IF;

  IF v_balance < p_amount THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID,
      format(
        'Insufficient balance. Available: ₦%s, Required: ₦%s',
        round((v_balance / 100.0)::numeric, 2),
        round((p_amount  / 100.0)::numeric, 2)
      )::TEXT,
      'insufficient_balance'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.ledger(user_id, type, delta, ref_type, note)
  VALUES(p_user_id, 'debit', -p_amount, 'withdrawal_debit', p_note)
  RETURNING id INTO v_ledger_id;

  INSERT INTO public.withdrawals(user_id, account_id, amount, status, ledger_entry_id)
  VALUES(p_user_id, p_account_id, p_amount, 'pending', v_ledger_id)
  RETURNING id INTO v_withdrawal_id;

  RETURN QUERY SELECT true, v_withdrawal_id, v_ledger_id, NULL::TEXT, NULL::TEXT;
END;
$$;

-- 9b. Atomic game entry debit + prize pool increment + single-use entry token
CREATE OR REPLACE FUNCTION public.safe_game_entry_debit(
  p_user_id    UUID,
  p_game_slug  TEXT,
  p_fee_kobo   INTEGER,
  p_week_start DATE,
  p_note       TEXT
) RETURNS TABLE(ok BOOLEAN, entry_token_id UUID, ledger_id UUID, pool_id UUID, new_balance_kobo BIGINT, err TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance   BIGINT;
  v_ledger_id UUID;
  v_pool_id   UUID;
  v_token_id  UUID;
BEGIN
  IF p_fee_kobo IS NULL OR p_fee_kobo < 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 0::BIGINT, 'Invalid entry fee'::TEXT;
    RETURN;
  END IF;

  SELECT balance_kobo INTO v_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 0::BIGINT, 'User not found'::TEXT;
    RETURN;
  END IF;

  IF p_fee_kobo > 0 THEN
    IF v_balance < p_fee_kobo THEN
      RETURN QUERY SELECT
        false, NULL::UUID, NULL::UUID, NULL::UUID, v_balance,
        format(
          'Insufficient balance. You need ₦%s to play (current balance: ₦%s).',
          round((p_fee_kobo / 100.0)::numeric, 2),
          round((v_balance  / 100.0)::numeric, 2)
        )::TEXT;
      RETURN;
    END IF;

    INSERT INTO public.ledger(user_id, type, delta, ref_type, note)
    VALUES(p_user_id, 'debit', -p_fee_kobo, 'game_entry_fee', p_note)
    RETURNING id INTO v_ledger_id;

    v_pool_id := public.record_game_entry(p_game_slug, p_fee_kobo, p_week_start);
    v_balance := v_balance - p_fee_kobo;
  END IF;

  INSERT INTO public.game_entry_tokens(user_id, game_slug, entry_fee_kobo, ledger_id, week_start)
  VALUES(p_user_id, p_game_slug, p_fee_kobo, v_ledger_id, p_week_start)
  RETURNING id INTO v_token_id;

  RETURN QUERY SELECT true, v_token_id, v_ledger_id, v_pool_id, v_balance, NULL::TEXT;
END;
$$;

-- 9c. Atomic news reading heartbeat (advisory-locked per user, global 50s cooldown)
CREATE OR REPLACE FUNCTION public.claim_news_heartbeat(
  p_user_id                 UUID,
  p_article_id              UUID,
  p_earn_kobo_per_minute    INTEGER,
  p_max_minutes_per_article INTEGER,
  p_daily_cap_minutes       INTEGER,
  p_min_interval_seconds    INTEGER,
  p_article_title           TEXT
) RETURNS TABLE(
  credited           BOOLEAN,
  kobo               INTEGER,
  reason             TEXT,
  minutes_on_article INTEGER,
  max_minutes        INTEGER,
  daily_minutes_used INTEGER,
  daily_cap_minutes  INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_read            RECORD;
  v_last_global     TIMESTAMPTZ;
  v_today_start     TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_daily_used      INTEGER;
  v_new_minutes     INTEGER;
BEGIN
  -- Serialize all news heartbeats for this user across all articles
  PERFORM pg_advisory_xact_lock(hashtext('news_hb:' || p_user_id::text));

  SELECT * INTO v_read
  FROM public.news_reads
  WHERE user_id = p_user_id AND article_id = p_article_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'not_started'::TEXT, 0, p_max_minutes_per_article, 0, p_daily_cap_minutes;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(minutes_credited), 0)::INTEGER INTO v_daily_used
  FROM public.news_reads
  WHERE user_id = p_user_id
    AND last_heartbeat_at >= v_today_start;

  -- Global cooldown across ALL articles for this user (prevents parallel-tab farming)
  SELECT MAX(last_heartbeat_at) INTO v_last_global
  FROM public.news_reads
  WHERE user_id = p_user_id;

  IF v_last_global IS NOT NULL AND EXTRACT(EPOCH FROM (now() - v_last_global)) < p_min_interval_seconds THEN
    RETURN QUERY SELECT false, 0, 'too_soon'::TEXT, v_read.minutes_credited, p_max_minutes_per_article, v_daily_used, p_daily_cap_minutes;
    RETURN;
  END IF;

  IF v_read.minutes_credited >= p_max_minutes_per_article THEN
    RETURN QUERY SELECT false, 0, 'article_cap'::TEXT, v_read.minutes_credited, p_max_minutes_per_article, v_daily_used, p_daily_cap_minutes;
    RETURN;
  END IF;

  IF v_daily_used >= p_daily_cap_minutes THEN
    RETURN QUERY SELECT false, 0, 'daily_cap'::TEXT, v_read.minutes_credited, p_max_minutes_per_article, v_daily_used, p_daily_cap_minutes;
    RETURN;
  END IF;

  v_new_minutes := v_read.minutes_credited + 1;

  UPDATE public.news_reads
  SET minutes_credited  = v_new_minutes,
      credited          = true,
      last_heartbeat_at = now()
  WHERE id = v_read.id;

  IF p_earn_kobo_per_minute > 0 THEN
    INSERT INTO public.ledger(user_id, type, delta, ref_type, ref_id, note)
    VALUES(
      p_user_id,
      'credit',
      p_earn_kobo_per_minute,
      'news_read_reward',
      p_article_id,
      format('News reading reward (min %s): %s', v_new_minutes, LEFT(COALESCE(p_article_title, ''), 80))
    );
  END IF;

  RETURN QUERY SELECT
    true,
    p_earn_kobo_per_minute,
    'credited'::TEXT,
    v_new_minutes,
    p_max_minutes_per_article,
    v_daily_used + 1,
    p_daily_cap_minutes;
END;
$$;

-- 9d. Atomic rewarded ad claim (advisory-locked per user: cooldown + daily cap + tier cap + log + ledger)
CREATE OR REPLACE FUNCTION public.claim_ad_reward(
  p_user_id          UUID,
  p_provider         TEXT,
  p_ad_type          TEXT,
  p_reward_kobo      INTEGER,
  p_session_id       TEXT,
  p_note             TEXT,
  p_daily_cap        INTEGER,
  p_cooldown_seconds INTEGER,
  p_tier_daily_limit INTEGER  -- NULL means unlimited
) RETURNS TABLE(
  ok             BOOLEAN,
  reason         TEXT,
  retry_after    INTEGER,
  daily_used     INTEGER,
  tier_used      INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today_start  TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_last_at      TIMESTAMPTZ;
  v_elapsed      INTEGER;
  v_daily_used   INTEGER;
  v_task_count   INTEGER;
  v_ad_count     INTEGER;
  v_tier_used    INTEGER;
BEGIN
  IF p_reward_kobo IS NULL OR p_reward_kobo <= 0 THEN
    RETURN QUERY SELECT false, 'invalid_reward'::TEXT, 0, 0, 0;
    RETURN;
  END IF;

  -- Serialize all ad/tier claims for this user
  PERFORM pg_advisory_xact_lock(hashtext('ad_claim:' || p_user_id::text));

  -- 1. Cooldown check
  IF p_cooldown_seconds > 0 THEN
    SELECT completed_at INTO v_last_at
    FROM public.ad_task_logs
    WHERE user_id = p_user_id AND provider = p_provider
    ORDER BY completed_at DESC
    LIMIT 1;

    IF v_last_at IS NOT NULL THEN
      v_elapsed := FLOOR(EXTRACT(EPOCH FROM (now() - v_last_at)))::INTEGER;
      IF v_elapsed < p_cooldown_seconds THEN
        RETURN QUERY SELECT false, 'cooldown'::TEXT, (p_cooldown_seconds - v_elapsed), 0, 0;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- 2. Provider daily cap check
  SELECT COUNT(*)::INTEGER INTO v_daily_used
  FROM public.ad_task_logs
  WHERE user_id = p_user_id
    AND provider = p_provider
    AND completed_at >= v_today_start;

  IF p_daily_cap > 0 AND v_daily_used >= p_daily_cap THEN
    RETURN QUERY SELECT false, 'daily_cap'::TEXT, 0, v_daily_used, 0;
    RETURN;
  END IF;

  -- 3. Tier daily limit check (tasks + ad logs today)
  IF p_tier_daily_limit IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_task_count
    FROM public.task_completions
    WHERE user_id = p_user_id
      AND status IN ('approved', 'pending')
      AND completed_at >= v_today_start;

    SELECT COUNT(*)::INTEGER INTO v_ad_count
    FROM public.ad_task_logs
    WHERE user_id = p_user_id
      AND completed_at >= v_today_start;

    v_tier_used := v_task_count + v_ad_count;
    IF v_tier_used >= p_tier_daily_limit THEN
      RETURN QUERY SELECT false, 'tier_limit'::TEXT, 0, v_daily_used, v_tier_used;
      RETURN;
    END IF;
  ELSE
    v_tier_used := 0;
  END IF;

  -- 4. Insert ad log (unique index on (provider, session_id) catches replays)
  BEGIN
    INSERT INTO public.ad_task_logs(user_id, provider, ad_type, reward_kobo, session_id)
    VALUES(p_user_id, p_provider, p_ad_type, p_reward_kobo, p_session_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'duplicate'::TEXT, 0, v_daily_used, v_tier_used;
    RETURN;
  END;

  -- 5. Credit ledger
  INSERT INTO public.ledger(user_id, type, delta, ref_type, note)
  VALUES(p_user_id, 'credit', p_reward_kobo, 'task_reward', p_note);

  RETURN QUERY SELECT true, 'credited'::TEXT, 0, v_daily_used + 1, v_tier_used + 1;
END;
$$;

-- 9e. Atomic phone OTP attempt increment (prevents concurrent brute-force race)
CREATE OR REPLACE FUNCTION public.increment_phone_otp_attempt(
  p_record_id    UUID,
  p_max_attempts INTEGER
) RETURNS TABLE(allowed BOOLEAN, attempts INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempts INTEGER;
BEGIN
  UPDATE public.phone_verification_codes
  SET attempts = phone_verification_codes.attempts + 1
  WHERE id = p_record_id
    AND phone_verification_codes.attempts < p_max_attempts
  RETURNING phone_verification_codes.attempts INTO v_attempts;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, p_max_attempts;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_attempts;
END;
$$;

-- 9f. Atomic video watch heartbeat (enforces min interval & wall-clock ceiling)
CREATE OR REPLACE FUNCTION public.record_video_heartbeat(
  p_user_id              UUID,
  p_task_id              UUID,
  p_min_interval_seconds INTEGER DEFAULT 8
) RETURNS TABLE(found BOOLEAN, recorded BOOLEAN, heartbeat_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session   RECORD;
  v_max_count INTEGER;
BEGIN
  SELECT * INTO v_session
  FROM public.video_watch_sessions
  WHERE user_id = p_user_id AND task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, 0;
    RETURN;
  END IF;

  IF v_session.last_heartbeat_at IS NOT NULL
     AND EXTRACT(EPOCH FROM (now() - v_session.last_heartbeat_at)) < p_min_interval_seconds THEN
    RETURN QUERY SELECT true, false, v_session.heartbeat_count;
    RETURN;
  END IF;

  v_max_count := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (now() - v_session.started_at)) / p_min_interval_seconds)::INTEGER);

  IF v_session.heartbeat_count >= v_max_count THEN
    RETURN QUERY SELECT true, false, v_session.heartbeat_count;
    RETURN;
  END IF;

  UPDATE public.video_watch_sessions
  SET heartbeat_count   = video_watch_sessions.heartbeat_count + 1,
      last_heartbeat_at = now()
  WHERE id = v_session.id
  RETURNING video_watch_sessions.heartbeat_count INTO v_max_count;

  RETURN QUERY SELECT true, true, v_max_count;
END;
$$;

-- ─── 10. REVOKE PUBLIC/anon/authenticated EXECUTE on all privileged RPCs ──────

REVOKE ALL ON FUNCTION public.safe_withdrawal_debit(UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.safe_withdrawal_debit(UUID, BIGINT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.safe_withdrawal_request(UUID, UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.safe_withdrawal_request(UUID, UUID, BIGINT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.record_game_entry(TEXT, INTEGER, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_game_entry(TEXT, INTEGER, DATE) TO service_role;

REVOKE ALL ON FUNCTION public.safe_game_entry_debit(UUID, TEXT, INTEGER, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.safe_game_entry_debit(UUID, TEXT, INTEGER, DATE, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.get_user_balance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_balance(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.get_platform_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO service_role;

REVOKE ALL ON FUNCTION public.claim_news_heartbeat(UUID, UUID, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_news_heartbeat(UUID, UUID, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_ad_reward(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.increment_phone_otp_attempt(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_phone_otp_attempt(UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.record_video_heartbeat(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_video_heartbeat(UUID, UUID, INTEGER) TO service_role;
