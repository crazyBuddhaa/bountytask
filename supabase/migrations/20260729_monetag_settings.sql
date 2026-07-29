-- ============================================================
-- Monetag ad network — platform_settings rows.
--
-- Four keys:
--   monetag_enabled                  — master toggle (sitewide Multitag)
--   monetag_multitag_script          — full <script> snippet for <head> (sitewide)
--   monetag_games_interstitial_enabled — separate toggle for games interstitial
--   monetag_games_interstitial_script  — full <script> snippet for games pages
--
-- Both script fields default to empty string; admin pastes the exact code
-- snippet from the Monetag publisher dashboard → Ad Channels.
-- ============================================================

INSERT INTO public.platform_settings (key, value) VALUES
  ('monetag_enabled',                    'false'),
  ('monetag_multitag_script',            '""'),
  ('monetag_games_interstitial_enabled', 'false'),
  ('monetag_games_interstitial_script',  '""')
ON CONFLICT (key) DO NOTHING;
