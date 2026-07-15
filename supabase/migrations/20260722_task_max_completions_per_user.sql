-- ============================================================
-- Per-user completion limit on tasks.
--
-- max_completions_per_user:
--   null  → no per-user limit (only the global max_completions cap applies)
--   1     → each user can complete this task once (existing/default behaviour)
--   N     → each user can complete this task up to N times
--
-- Default is 1 so all existing tasks preserve their current one-per-user
-- behaviour without any data migration.
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS max_completions_per_user INT DEFAULT 1;

COMMENT ON COLUMN public.tasks.max_completions_per_user IS
  'How many times a single user may complete this task. NULL = unlimited. Default 1 = once per user.';
