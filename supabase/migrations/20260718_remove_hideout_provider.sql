-- ============================================================
-- Remove HideoutTV ad provider
-- HideoutTV was never a real, self-serve ad network with a
-- verifiable publisher program — removed in favor of adding a
-- real replacement (e.g. AdGate Media, OfferToro) later.
-- ============================================================

-- Drop its platform_settings rows.
DELETE FROM public.platform_settings
WHERE key IN (
  'hideout_enabled',
  'hideout_daily_cap',
  'hideout_reward_kobo',
  'hideout_publisher_id',
  'hideout_secret'
);

-- Any historical ad_task_logs rows for "hideout" are kept for record-keeping,
-- but the CHECK constraint no longer needs to admit new "hideout" rows.
ALTER TABLE public.ad_task_logs DROP CONSTRAINT IF EXISTS ad_task_logs_provider_check;
ALTER TABLE public.ad_task_logs
  ADD CONSTRAINT ad_task_logs_provider_check
  CHECK (provider IN ('ima', 'hideout', 'lootably', 'ayet', 'cpx'));
-- Note: "hideout" is kept in the CHECK list solely so existing historical
-- rows remain valid; the application no longer writes new "hideout" rows.
