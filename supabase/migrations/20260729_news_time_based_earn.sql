-- ============================================================
-- BountyTask — News: switch to time-based (per-minute) earning
-- ============================================================
-- Adds per-article time tracking columns to news_reads and
-- seeds the new per-minute reward settings.

alter table public.news_reads
  add column if not exists minutes_credited     integer    not null default 0,
  add column if not exists last_heartbeat_at    timestamptz;

-- Index so the daily cap query is fast
create index if not exists idx_news_reads_user_credited
  on public.news_reads (user_id, credited, read_at desc);

-- New settings
insert into public.platform_settings (key, value) values
  ('news_earn_kobo_per_minute',         '200'),   -- ₦2.00 per minute on a page
  ('news_earn_max_minutes_per_article', '5'),      -- cap per single article
  ('news_earn_daily_cap_minutes',       '30')      -- daily ceiling across all articles
on conflict (key) do nothing;

-- Remove the old flat "kobo per read" key if no longer relevant
-- (kept for backward compat – getNewsSettings reads both and new key takes priority)
