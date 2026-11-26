-- ============================================================
-- BountyTask — Video Watch Requirement Modes (Full / Half / Custom)
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS video_watch_mode TEXT NOT NULL DEFAULT 'custom'
  CHECK (video_watch_mode IN ('full', 'half', 'custom'));

ALTER TABLE public.video_watch_sessions
  ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER;
