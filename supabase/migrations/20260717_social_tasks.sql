-- ============================================================
-- BountyTask — Social Tasks + AI Vision Verification
-- ============================================================
-- Adds social media task fields to the tasks table and AI
-- verdict fields to task_completions.
-- ============================================================

-- ─── Social task columns on tasks ────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS social_platform            text
    CHECK (social_platform IN ('twitter_x','instagram','tiktok','youtube','facebook','threads')),
  ADD COLUMN IF NOT EXISTS social_action              text
    CHECK (social_action IN ('follow','like','comment','repost','subscribe')),
  ADD COLUMN IF NOT EXISTS social_target_handle       text,
  ADD COLUMN IF NOT EXISTS social_target_post_url     text,
  ADD COLUMN IF NOT EXISTS social_required_comment_text text,
  ADD COLUMN IF NOT EXISTS ai_verify_screenshot       boolean NOT NULL DEFAULT false;

-- ─── AI verdict columns on task_completions ──────────────────
ALTER TABLE public.task_completions
  ADD COLUMN IF NOT EXISTS ai_verdict    text
    CHECK (ai_verdict IN ('approved','rejected','uncertain')),
  ADD COLUMN IF NOT EXISTS ai_confidence smallint
    CHECK (ai_confidence BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS ai_reason     text;

-- ─── Index for quickly finding social tasks by platform ──────
CREATE INDEX IF NOT EXISTS idx_tasks_social_platform
  ON public.tasks (social_platform)
  WHERE social_platform IS NOT NULL;

-- ─── Index for filtering completions by AI verdict ───────────
CREATE INDEX IF NOT EXISTS idx_completions_ai_verdict
  ON public.task_completions (ai_verdict)
  WHERE ai_verdict IS NOT NULL;
