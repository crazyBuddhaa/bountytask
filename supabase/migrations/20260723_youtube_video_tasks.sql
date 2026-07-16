-- YouTube video watch task support
-- Adds two nullable columns to tasks + a lightweight watch-session table
-- used by the server-side heartbeat verification system.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS youtube_url        TEXT,
  ADD COLUMN IF NOT EXISTS min_watch_seconds  INTEGER;

-- One row per (user, task) pair. Upserted when the user starts watching;
-- heartbeat_count incremented every ~10 s while the player is in PLAYING state.
CREATE TABLE IF NOT EXISTS public.video_watch_sessions (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  task_id             UUID        NOT NULL REFERENCES public.tasks(id)  ON DELETE CASCADE,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at   TIMESTAMPTZ,
  heartbeat_count     INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (user_id, task_id)
);

ALTER TABLE public.video_watch_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only read / write their own sessions
CREATE POLICY "video_watch_sessions_own"
  ON public.video_watch_sessions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Speed up the "next unwatched video" queue query
CREATE INDEX IF NOT EXISTS tasks_youtube_queue_idx
  ON public.tasks (created_at ASC)
  WHERE youtube_url IS NOT NULL AND status = 'active';
