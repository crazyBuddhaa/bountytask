-- ============================================================
-- Ad Provider Platform Settings
-- One row per config key in platform_settings.
-- All values default to disabled/empty — admin must configure
-- each provider before the dashboard pages go live.
-- ============================================================

INSERT INTO public.platform_settings (key, value) VALUES

  -- ── Google IMA SDK (rewarded video, 2x daily cap) ────────────
  ('ima_enabled',      'false'),
  ('ima_daily_cap',    '2'),
  ('ima_reward_kobo',  '50'),      -- ₦0.50 per view; tune after seeing real eCPMs
  ('ima_ad_tag_url',   '""'),      -- VAST/IMA ad tag URL from Google Ad Manager

  -- ── HideoutTV (watch-videos sessions, 5x daily cap) ──────────
  ('hideout_enabled',       'false'),
  ('hideout_daily_cap',     '5'),
  ('hideout_reward_kobo',   '100'),  -- ₦1.00 per qualifying session
  ('hideout_publisher_id',  '""'),   -- HideoutTV publisher ID
  ('hideout_secret',        '""'),   -- HMAC-SHA256 signing secret

  -- ── Lootably (mixed offer wall, 10x daily cap) ───────────────
  ('lootably_enabled',    'false'),
  ('lootably_daily_cap',  '10'),
  ('lootably_api_key',    '""'),   -- Lootably publisher API key
  ('lootably_secret',     '""'),   -- Postback signing secret

  -- ── Ayet Studios (surveys & offers wall, 10x daily cap) ──────
  ('ayet_enabled',        'false'),
  ('ayet_daily_cap',      '10'),
  ('ayet_placement_key',  '""'),   -- Ayet placement/publisher key
  ('ayet_secret_key',     '""'),   -- HMAC-SHA256 signing secret

  -- ── CPX Research (survey wall, 10x daily cap) ────────────────
  ('cpx_enabled',          'false'),
  ('cpx_daily_cap',        '10'),
  ('cpx_app_id',           '""'),  -- CPX Research App ID
  ('cpx_secure_hash_key',  '""')   -- MD5 hash key for postback validation

ON CONFLICT (key) DO NOTHING;
