-- ============================================================
-- Ad Task Logs — per-user, per-provider completion tracking
-- Powers daily cap enforcement and session deduplication for
-- all rewarded ad providers (IMA, HideoutTV, Lootably, Ayet, CPX).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ad_task_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider     TEXT        NOT NULL CHECK (provider IN ('ima', 'hideout', 'lootably', 'ayet', 'cpx')),
  ad_type      TEXT        NOT NULL CHECK (ad_type IN ('video', 'survey', 'offer', 'mixed')),
  reward_kobo  BIGINT      NOT NULL DEFAULT 0,
  -- Provider's own transaction/session ID — used for idempotency.
  -- A UNIQUE partial index on (provider, session_id) prevents the same
  -- postback being credited twice even under concurrent requests.
  session_id   TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Used by checkAdDailyCap: count completions per user+provider since UTC midnight
CREATE INDEX idx_ad_task_logs_user_provider_date
  ON public.ad_task_logs(user_id, provider, completed_at DESC);

-- Prevents replayed postbacks from crediting the user twice
CREATE UNIQUE INDEX idx_ad_task_logs_session_dedup
  ON public.ad_task_logs(provider, session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.ad_task_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own logs (e.g. to show daily cap progress on the page)
CREATE POLICY "Users can view own ad logs"
  ON public.ad_task_logs FOR SELECT
  USING (auth.uid() = user_id);

-- All inserts go through the admin client (service role) in postback routes —
-- no INSERT policy needed here.
