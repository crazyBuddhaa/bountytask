-- ============================================================
-- BountyTask — Ensure ledger.ref_type allows games & news rewards
-- ============================================================
-- 001_initial_schema.sql created ledger_ref_type_check with only 7 values.
-- Add 'game_entry_fee', 'game_prize', and 'news_read_reward' so paid games,
-- weekly prize payouts, and news reading credits never fail the CHECK constraint.

ALTER TABLE public.ledger
  DROP CONSTRAINT IF EXISTS ledger_ref_type_check;

ALTER TABLE public.ledger
  ADD CONSTRAINT ledger_ref_type_check
  CHECK (ref_type IN (
    'task_reward',
    'referral_bonus',
    'signup_bonus',
    'withdrawal_debit',
    'withdrawal_reversal',
    'admin_adjustment',
    'penalty',
    'game_entry_fee',
    'game_prize',
    'news_read_reward'
  ));
