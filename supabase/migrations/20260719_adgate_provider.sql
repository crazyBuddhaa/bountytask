-- ============================================================
-- AdGate Media ad provider
-- Added as a real, verified replacement for the removed HideoutTV
-- provider. AdGate verifies postbacks by source IP rather than a
-- signed hash, so no secret key setting is needed — just the wall
-- ID and the IP shown on the AdGate affiliate panel.
-- ============================================================

INSERT INTO public.platform_settings (key, value) VALUES
  ('adgate_enabled',      'false'),
  ('adgate_daily_cap',    '10'),
  ('adgate_wall_id',      '""'),   -- AdGate VC Wall ID
  ('adgate_postback_ip',  '""')    -- Trusted source IP for postback verification
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.ad_task_logs DROP CONSTRAINT IF EXISTS ad_task_logs_provider_check;
ALTER TABLE public.ad_task_logs
  ADD CONSTRAINT ad_task_logs_provider_check
  CHECK (provider IN ('ima', 'hideout', 'lootably', 'ayet', 'cpx', 'adgate'));
