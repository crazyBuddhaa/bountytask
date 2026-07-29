-- ============================================================
-- BountyTask — News Feed
-- ============================================================

-- Stores deduplicated article headlines pulled from RSS feeds.
create table public.news_articles (
  id            uuid        primary key default gen_random_uuid(),
  title         text        not null,
  snippet       text,
  thumbnail_url text,
  source_name   text        not null,
  article_url   text        not null,
  category      text        not null default 'general',
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  is_active     boolean     not null default true
);

-- Deduplication index: one row per article URL
create unique index idx_news_articles_url    on public.news_articles(article_url);
create index idx_news_articles_active_pub   on public.news_articles(is_active, published_at desc);
create index idx_news_articles_category_pub on public.news_articles(category, published_at desc);

-- Tracks which user opened which article; doubles as earn ledger gate.
create table public.news_reads (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id)         on delete cascade,
  article_id  uuid        not null references public.news_articles(id) on delete cascade,
  read_at     timestamptz not null default now(),
  credited    boolean     not null default false,
  unique(user_id, article_id)
);

create index idx_news_reads_user_date on public.news_reads(user_id, read_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.news_articles enable row level security;
create policy "Public can read active articles"
  on public.news_articles for select using (is_active = true);

alter table public.news_reads enable row level security;
create policy "Users can insert own reads"
  on public.news_reads for insert with check (auth.uid() = user_id);
create policy "Users can read own reads"
  on public.news_reads for select using (auth.uid() = user_id);

-- ── platform_settings seeds ───────────────────────────────────────────────────

insert into public.platform_settings (key, value) values
  ('news_enabled',              'false'),
  ('news_earn_enabled',         'false'),
  ('news_earn_kobo_per_read',   '5'),
  ('news_earn_daily_cap',       '20')
on conflict (key) do nothing;
