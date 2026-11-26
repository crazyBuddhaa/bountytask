-- ============================================================
-- BountyTask — Add 'math-sprint' (Quick Math Blitz) game slug
-- ============================================================

-- 1. Update game_sessions.game_slug CHECK constraint
ALTER TABLE public.game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_game_slug_check;

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_game_slug_check
  CHECK (game_slug IN (
    'wordle','higher-or-lower','tap-target','2048','color-rush','word-scramble','math-sprint'
  ));

-- 2. Update game_entry_tokens.game_slug CHECK constraint (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'game_entry_tokens'
  ) THEN
    ALTER TABLE public.game_entry_tokens
      DROP CONSTRAINT IF EXISTS game_entry_tokens_game_slug_check;
    ALTER TABLE public.game_entry_tokens
      ADD CONSTRAINT game_entry_tokens_game_slug_check
      CHECK (game_slug IN (
        'wordle','higher-or-lower','tap-target','2048','color-rush','word-scramble','math-sprint'
      ));
  END IF;
END $$;

-- 3. Seed default entry fee for Quick Math Blitz (₦5 = 500 kobo)
INSERT INTO public.platform_settings (key, value) VALUES
  ('game_entry_fee_math_sprint', '500')
ON CONFLICT (key) DO NOTHING;
