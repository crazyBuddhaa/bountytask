-- Add full article content column (populated lazily on first open).
-- Nullable so existing rows and newly fetched articles start empty.
alter table public.news_articles
  add column if not exists content text;
