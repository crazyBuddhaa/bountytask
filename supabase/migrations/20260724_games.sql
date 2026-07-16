-- ============================================================
-- BountyTask — Games Feature (Phase 1: free play, no ad gate)
-- ============================================================

create table public.game_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  game_slug        text not null check (game_slug in (
                     'wordle','higher-or-lower','tap-target','2048','color-rush','word-scramble'
                   )),
  score            integer not null default 0,
  completed        boolean not null default false,
  duration_seconds integer,
  metadata         jsonb not null default '{}',
  played_at        timestamptz not null default now()
);

create index idx_game_sessions_user_game  on public.game_sessions(user_id, game_slug);
create index idx_game_sessions_played_at  on public.game_sessions(played_at desc);
create index idx_game_sessions_score      on public.game_sessions(game_slug, score desc);

-- RLS
alter table public.game_sessions enable row level security;

create policy "Users can insert own game sessions"
  on public.game_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can read own game sessions"
  on public.game_sessions for select
  using (auth.uid() = user_id);

-- Weekly leaderboard view (Mon–Sun UTC, best completed score per user per game)
create or replace view public.weekly_leaderboard as
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
