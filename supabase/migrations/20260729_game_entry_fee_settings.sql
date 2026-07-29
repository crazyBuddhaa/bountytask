-- ============================================================
-- BountyTask — Seed game entry fee platform_settings keys
-- ============================================================
-- These keys are read by /api/games/enter and /api/games/my-stats.
-- Values are in kobo (1 NGN = 100 kobo). Set to 0 to make a game free.
-- game_entry_fees_enabled acts as a global master switch.

insert into public.platform_settings (key, value) values
  ('game_entry_fees_enabled',        'false'),
  ('game_entry_fee_wordle',          '1000'),   -- ₦10.00
  ('game_entry_fee_higher_or_lower', '1000'),   -- ₦10.00
  ('game_entry_fee_tap_target',      '500'),    -- ₦5.00
  ('game_entry_fee_2048',            '500'),    -- ₦5.00
  ('game_entry_fee_color_rush',      '500'),    -- ₦5.00
  ('game_entry_fee_word_scramble',   '500')     -- ₦5.00
on conflict (key) do nothing;
