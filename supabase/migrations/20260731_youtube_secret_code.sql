-- ============================================================
-- BountyTask — YouTube Video Secret Code Verification Mode
-- ============================================================
-- When video_secret_code is set on a YouTube task, users open the
-- video natively on YouTube (avoiding iframe invalid-traffic flags),
-- wait at least min_watch_seconds, and enter the secret word/code
-- shown or spoken inside the video to claim their reward.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS video_secret_code TEXT,
  ADD COLUMN IF NOT EXISTS video_code_hint   TEXT;
