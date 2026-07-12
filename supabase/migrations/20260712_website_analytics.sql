-- Website traffic analytics: raw page-view events used to compute daily
-- visitors, DAU, registered vs. unregistered traffic, and time-on-site.
create table public.analytics_page_views (
  id               uuid primary key default gen_random_uuid(),
  visitor_id       uuid not null,               -- long-lived anonymous cookie id
  session_id       uuid not null,                -- per-browser-session id (sessionStorage)
  user_id          uuid references public.users(id) on delete set null,
  path             text not null,
  referrer         text,
  user_agent       text,
  duration_seconds integer not null default 0,   -- updated by heartbeat/beacon while the page is open
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_analytics_page_views_created_at on public.analytics_page_views(created_at);
create index idx_analytics_page_views_visitor_id on public.analytics_page_views(visitor_id);
create index idx_analytics_page_views_user_id    on public.analytics_page_views(user_id);
create index idx_analytics_page_views_session_id on public.analytics_page_views(session_id);

alter table public.analytics_page_views enable row level security;
-- Intentionally no public policies: writes happen through /api/analytics/*
-- and reads through /api/admin/analytics, both using the service-role
-- admin client, which bypasses RLS. No direct client access is granted.
