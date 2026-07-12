-- Add task-completion-based tier advancement.
-- Users can now reach a higher tier by completing enough tasks, in addition
-- to (or instead of) the existing referral-count path. Whichever threshold
-- the user hits first promotes them. `min_completions = 0` on Tier 1 means
-- every new user starts there regardless of activity.

ALTER TABLE tiers ADD COLUMN IF NOT EXISTS min_completions INT NOT NULL DEFAULT 0;

-- Seed reasonable task-completion thresholds that mirror the referral curve.
UPDATE tiers SET min_completions = 0   WHERE id = 1;
UPDATE tiers SET min_completions = 25  WHERE id = 2;
UPDATE tiers SET min_completions = 75  WHERE id = 3;
UPDATE tiers SET min_completions = 150 WHERE id = 4;
UPDATE tiers SET min_completions = 300 WHERE id = 5;
UPDATE tiers SET min_completions = 600 WHERE id = 6;
