-- ============================================================
-- Fix: weekly_leaderboard view — switch from SECURITY DEFINER
-- (implicit default) to SECURITY INVOKER so the view respects
-- the RLS policies of the querying user rather than bypassing
-- them with the view owner's elevated permissions.
--
-- Because the leaderboard must show every player's best score
-- (not just the querying user's own rows), we also add a
-- targeted SELECT policy that allows any authenticated user to
-- read completed game sessions. Incomplete/abandoned sessions
-- remain protected by the existing "Users can read own game
-- sessions" policy.
-- ============================================================

-- 1. Allow reading completed sessions from all users (leaderboard reads)
--    The existing "Users can read own game sessions" policy continues
--    to cover in-progress/incomplete sessions for the session owner.
create policy "Authenticated users can read completed game sessions"
  on public.game_sessions for select
  using (
    auth.uid() is not null
    and completed = true
  );

-- 2. Recreate the view with security_invoker = true so it evaluates
--    RLS as the calling user, not as the view owner (postgres/service role).
create or replace view public.weekly_leaderboard
  with (security_invoker = true)
as
select
  gs.game_slug,
  gs.user_id,
  u.username,
  u.full_name,
  u.avatar_url,
  max(gs.score)       as best_score,
  count(*)            as play_count,
  max(gs.played_at)   as last_played_at
from public.game_sessions gs
join public.users u on u.id = gs.user_id
where gs.played_at >= date_trunc('week', now())
  and gs.completed = true
group by gs.game_slug, gs.user_id, u.username, u.full_name, u.avatar_url;
