-- Referral-based user tiers (1-6). A user's tier is recalculated automatically
-- whenever they onboard a new referral; higher tiers unlock a higher daily
-- task-completion limit and other perks. Every threshold, limit, and perk
-- description here is editable by admins via /admin/tiers.

CREATE TABLE IF NOT EXISTS tiers (
  id                SMALLINT PRIMARY KEY CHECK (id BETWEEN 1 AND 6),
  name              TEXT NOT NULL,
  min_referrals     INT NOT NULL DEFAULT 0,
  daily_task_limit  INT NOT NULL DEFAULT 10,
  perks             TEXT NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES auth.users(id)
);

INSERT INTO tiers (id, name, min_referrals, daily_task_limit, perks) VALUES
  (1, 'Starter',  0,   8,  'Access to all standard tasks'),
  (2, 'Bronze',   5,   12, 'Higher daily task limit + Bronze-exclusive tasks'),
  (3, 'Silver',   15,  18, 'Higher daily task limit + Silver-exclusive tasks + faster review'),
  (4, 'Gold',     30,  25, 'Higher daily task limit + Gold-exclusive tasks + priority review'),
  (5, 'Platinum', 60,  35, 'Higher daily task limit + Platinum-exclusive tasks + priority support'),
  (6, 'Diamond',  100, 50, 'Highest daily task limit + all exclusive tasks + priority support + early access to new tasks')
ON CONFLICT (id) DO NOTHING;

-- A user's current tier. Defaults to Starter (1) for everyone.
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier SMALLINT NOT NULL DEFAULT 1 REFERENCES tiers(id);

ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tiers" ON tiers FOR SELECT USING (true);
CREATE POLICY "Admins manage tiers" ON tiers FOR ALL USING (is_admin());
