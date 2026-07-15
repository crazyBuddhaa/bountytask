-- ============================================================
-- Adsterra smartlink architecture rework.
--
-- Original design assumed per-user S2S postbacks — those exist
-- only on the advertiser side of Adsterra, not for publishers.
-- The correct model is:
--   - Optimistic fixed-kobo credit at click time
--   - Tight daily cap (3) + cooldown enforced server-side
--   - Weekly manual reconciliation against Adsterra revenue
--
-- Changes:
--   - Remove asterra_secret_key  (no postback, no signature to verify)
--   - Add    asterra_reward_kobo (fixed internal reward per click)
--   - Update default daily cap to 3 (from 10)
-- ============================================================

DELETE FROM public.platform_settings WHERE key = 'asterra_secret_key';

INSERT INTO public.platform_settings (key, value) VALUES
  ('asterra_reward_kobo', '250')     -- ₦2.50 default; reconcile weekly
ON CONFLICT (key) DO NOTHING;

-- Tighten default daily cap
UPDATE public.platform_settings
   SET value = '3'
 WHERE key = 'asterra_daily_cap' AND value = '10';
