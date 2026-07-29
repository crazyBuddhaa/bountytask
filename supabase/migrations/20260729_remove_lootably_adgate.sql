-- ============================================================
-- Remove Lootably and AdGate provider remnants.
--
-- Both providers were already removed from application code.
-- This migration cleans up:
--   1. Stale platform_settings rows for lootably_* and adgate_*
--   2. The ad_task_logs.provider CHECK constraint — drops the
--      old constraint (which still listed lootably, adgate,
--      hideout, and ayet) and replaces it with one that reflects
--      the three active providers: ima, cpx, asterra.
--
-- Safe to run on a live DB: DELETE + ALTER TABLE ... VALIDATE
-- CONSTRAINT only touch rows/constraints, not data in use.
-- ============================================================

-- 1. Remove stale platform_settings rows
DELETE FROM public.platform_settings
 WHERE key IN (
   'lootably_enabled',
   'lootably_daily_cap',
   'lootably_api_key',
   'lootably_secret',
   'adgate_enabled',
   'adgate_daily_cap',
   'adgate_wall_id',
   'adgate_postback_ip'
 );

-- 2. Update the CHECK constraint on ad_task_logs.provider
--    to only allow the three providers still in use.
--
--    PostgreSQL does not support ALTER CONSTRAINT for CHECK
--    constraints, so we drop and re-add.
ALTER TABLE public.ad_task_logs
  DROP CONSTRAINT IF EXISTS ad_task_logs_provider_check;

ALTER TABLE public.ad_task_logs
  ADD CONSTRAINT ad_task_logs_provider_check
  CHECK (provider IN ('ima', 'cpx', 'asterra'));
