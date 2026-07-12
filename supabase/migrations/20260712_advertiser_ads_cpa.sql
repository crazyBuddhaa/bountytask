-- Advertiser self-serve submissions, in-app ad placements, and CPA/affiliate cost
-- tracking on tasks. All three are admin-controlled and off by default.

-- ── 1. Platform settings: advertiser submissions ──────────────────────────────
INSERT INTO platform_settings (key, value) VALUES
  ('advertiser_submissions_enabled',     'false'),
  ('advertiser_min_budget_kobo',         '500000'),
  ('advertiser_requirements',            '"Tasks must be legal, safe, and verifiable. Provide clear proof requirements and a working destination link. We reserve the right to reject any submission."'),
  ('advertiser_pricing_info',            '"Flat-fee tasks: you set the total budget and per-completion reward. CPA/affiliate offers: you pay per verified action, we handle worker payouts from our own balance."'),
  ('advertiser_contact_email',           '"partners@bountytask.ng"'),
  ('advertiser_submission_fee_enabled',  'false'),
  ('advertiser_submission_fee_kobo',     '500000')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Platform settings: in-app display ads ──────────────────────────────────
INSERT INTO platform_settings (key, value) VALUES
  ('ads_enabled',            'false'),
  ('ads_dashboard_snippet',  '""'),
  ('ads_tasklist_snippet',   '""')
ON CONFLICT (key) DO NOTHING;

-- ── 3. Advertiser task submissions (leads awaiting admin review) ─────────────
CREATE TABLE IF NOT EXISTS task_submissions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name        TEXT        NOT NULL,
  contact_name        TEXT,
  contact_email       TEXT        NOT NULL,
  contact_phone       TEXT,
  task_title          TEXT        NOT NULL,
  description         TEXT        NOT NULL,
  instructions         TEXT,
  category_id         UUID        REFERENCES task_categories(id),
  task_type           TEXT        NOT NULL DEFAULT 'verified' CHECK (task_type IN ('verified', 'unverified')),
  proposed_reward_kobo INTEGER    NOT NULL CHECK (proposed_reward_kobo > 0),
  desired_completions  INTEGER    CHECK (desired_completions > 0),
  budget_kobo          INTEGER    NOT NULL CHECK (budget_kobo > 0),
  cost_type            TEXT       NOT NULL DEFAULT 'flat' CHECK (cost_type IN ('flat', 'cpa')),
  proof_requirements   TEXT,
  verification_url     TEXT,
  payment_reference     TEXT,
  payment_status         TEXT      NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'waived')),
  status                TEXT       NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes            TEXT,
  created_task_id        UUID      REFERENCES tasks(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at            TIMESTAMPTZ,
  reviewed_by            UUID      REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON task_submissions(status);

-- Advertiser leads are unauthenticated (no user_id) and reviewed by admins only —
-- service role (admin client) access, same pattern as pending_verifications.
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- ── 4. CPA/affiliate cost tracking on tasks ───────────────────────────────────
-- reward_amount stays "what the worker earns" (existing column). These new
-- columns capture "what the platform earns/spends" so margin is visible:
--   - task_source: who created it — internal ops vs an approved advertiser lead
--   - cost_type: 'flat' (advertiser pre-paid a fixed budget) or 'cpa' (platform
--     receives advertiser_cost_kobo per completion from an affiliate network/
--     advertiser, and reward_amount is the payout to the worker out of that)
--   - advertiser_cost_kobo: revenue per completion in kobo, null for tasks with
--     no external revenue (ordinary internal tasks)
--   - submission_id: links back to the advertiser lead that created this task
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_source TEXT NOT NULL DEFAULT 'internal' CHECK (task_source IN ('internal', 'advertiser')),
  ADD COLUMN IF NOT EXISTS cost_type TEXT NOT NULL DEFAULT 'flat' CHECK (cost_type IN ('flat', 'cpa')),
  ADD COLUMN IF NOT EXISTS advertiser_cost_kobo INTEGER CHECK (advertiser_cost_kobo IS NULL OR advertiser_cost_kobo >= 0),
  ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES task_submissions(id);
