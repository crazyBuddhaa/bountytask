-- ============================================================
-- Asterra smartlink ad provider
-- Uses static-secret postback auth (no HMAC — standard for
-- smartlink/CPA networks). The admin sets a self-generated
-- secret token that is appended to the postback URL they
-- configure in Asterra's dashboard.
-- ============================================================

INSERT INTO public.platform_settings (key, value) VALUES
  ('asterra_enabled',       'false'),
  ('asterra_daily_cap',     '10'),
  ('asterra_smartlink_url', '""'),  -- Base smartlink URL from Asterra dashboard
  ('asterra_secret_key',    '""')   -- Random token you generate; appended to postback URL
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.ad_task_logs DROP CONSTRAINT IF EXISTS ad_task_logs_provider_check;
ALTER TABLE public.ad_task_logs
  ADD CONSTRAINT ad_task_logs_provider_check
  CHECK (provider IN ('ima', 'hideout', 'lootably', 'ayet', 'cpx', 'adgate', 'asterra'));
