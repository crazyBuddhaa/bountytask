-- ============================================================
-- BountyTask — Games Phase 2: Entry Fee + Prize Pool
-- ============================================================

-- Add entry fee tracking to game sessions
alter table public.game_sessions
  add column if not exists entry_fee_kobo integer not null default 0;

-- ── Prize pools ───────────────────────────────────────────────────────────────
-- One row per (game, week). Updated atomically via RPC to avoid races.
create table if not exists public.game_prize_pools (
  id                   uuid primary key default gen_random_uuid(),
  game_slug            text not null,
  week_start           date not null,             -- Monday (UTC) of the week
  total_entries        integer not null default 0,
  total_collected_kobo bigint  not null default 0,
  prize_pool_kobo      bigint  not null default 0, -- 80 % of collected
  platform_cut_kobo    bigint  not null default 0, -- 20 %
  settled              boolean not null default false,
  settled_at           timestamptz,
  settled_by           uuid references public.users(id),
  created_at           timestamptz not null default now(),
  constraint uq_game_prize_pools unique (game_slug, week_start)
);

create index if not exists idx_prize_pools_week  on public.game_prize_pools(week_start desc);
create index if not exists idx_prize_pools_slug  on public.game_prize_pools(game_slug);

-- RLS: admins only (queried server-side with admin client)
alter table public.game_prize_pools enable row level security;
create policy "Admin full access to prize pools"
  on public.game_prize_pools for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'super_admin')
    )
  );

-- ── Leaderboard payouts ───────────────────────────────────────────────────────
create table if not exists public.leaderboard_payouts (
  id            uuid primary key default gen_random_uuid(),
  prize_pool_id uuid not null references public.game_prize_pools(id),
  user_id       uuid not null references public.users(id) on delete cascade,
  game_slug     text not null,
  week_start    date not null,
  rank          integer not null,
  score         integer not null,
  payout_kobo   bigint not null,
  ledger_id     uuid,   -- set after ledger entry is written
  created_at    timestamptz not null default now()
);

create index if not exists idx_payouts_user      on public.leaderboard_payouts(user_id);
create index if not exists idx_payouts_pool      on public.leaderboard_payouts(prize_pool_id);
create index if not exists idx_payouts_week_slug on public.leaderboard_payouts(week_start, game_slug);

alter table public.leaderboard_payouts enable row level security;
create policy "Users can read own payouts"
  on public.leaderboard_payouts for select
  using (auth.uid() = user_id);
create policy "Admin full access to payouts"
  on public.leaderboard_payouts for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'super_admin')
    )
  );

-- ── Helper: get start of current ISO week (Monday) ───────────────────────────
create or replace function public.current_week_start()
returns date language sql stable as $$
  select date_trunc('week', now() at time zone 'UTC')::date;
$$;

-- ── RPC: atomically add an entry to a prize pool ─────────────────────────────
-- Called server-side after deducting the entry fee from the ledger.
create or replace function public.record_game_entry(
  p_game_slug    text,
  p_fee_kobo     integer,
  p_week_start   date
) returns uuid language plpgsql security definer as $$
declare
  v_pool_id uuid;
  v_prize   bigint;
  v_cut     bigint;
begin
  v_prize := floor(p_fee_kobo * 0.8);
  v_cut   := p_fee_kobo - v_prize;

  insert into public.game_prize_pools (game_slug, week_start, total_entries, total_collected_kobo, prize_pool_kobo, platform_cut_kobo)
  values (p_game_slug, p_week_start, 1, p_fee_kobo, v_prize, v_cut)
  on conflict (game_slug, week_start) do update
    set total_entries        = game_prize_pools.total_entries + 1,
        total_collected_kobo = game_prize_pools.total_collected_kobo + p_fee_kobo,
        prize_pool_kobo      = game_prize_pools.prize_pool_kobo + v_prize,
        platform_cut_kobo    = game_prize_pools.platform_cut_kobo + v_cut
  returning id into v_pool_id;

  return v_pool_id;
end;
$$;
