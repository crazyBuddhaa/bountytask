-- ============================================================
-- BountyTask — Unit-economics tuning & CPX margin share
-- ============================================================
-- Lowers default news-reading and Adsterra payouts where still
-- at the original defaults (preserving any custom admin values)
-- and seeds the CPX Research user revenue share percentage.

-- 1. News reading: ₦2.00/min -> ₦0.30/min (30 kobo)
UPDATE public.platform_settings
   SET value = '30'
 WHERE key = 'news_earn_kobo_per_minute' AND value = '200';

-- 2. News reading: max 5 min/article -> 3 min/article
UPDATE public.platform_settings
   SET value = '3'
 WHERE key = 'news_earn_max_minutes_per_article' AND value = '5';

-- 3. Adsterra smartlink: ₦2.50/click -> ₦0.40/click (40 kobo)
UPDATE public.platform_settings
   SET value = '40'
 WHERE key = 'asterra_reward_kobo' AND value = '250';

-- 4. Minimum withdrawal: ₦5,000 -> ₦3,000 (300,000 kobo)
UPDATE public.platform_settings
   SET value = '300000'
 WHERE key = 'min_withdrawal_kobo' AND value = '500000';

-- 5. Seed defaults if missing (including CPX user share = 65%, keeping 35% platform margin)
INSERT INTO public.platform_settings (key, value) VALUES
  ('news_earn_kobo_per_minute',         '30'),
  ('news_earn_max_minutes_per_article', '3'),
  ('asterra_reward_kobo',               '40'),
  ('cpx_user_share_percent',            '65'),
  ('min_withdrawal_kobo',               '300000')
ON CONFLICT (key) DO NOTHING;
