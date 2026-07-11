-- Platform settings key/value store
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id)
);

-- Seed defaults
INSERT INTO platform_settings (key, value) VALUES
  ('verification_fee_enabled',    'false'),
  ('verification_fee_amount',     '50000'),
  ('verification_payment_method', '"paystack"'),
  ('bank_transfer_name',          '""'),
  ('bank_transfer_number',        '""'),
  ('bank_transfer_bank',          '""')
ON CONFLICT (key) DO NOTHING;

-- Only service role (admin client) can access
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Pending bank-transfer registrations
CREATE TABLE IF NOT EXISTS pending_verifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT        NOT NULL,
  email             TEXT        NOT NULL UNIQUE,
  referral_code     TEXT,
  payment_reference TEXT        NOT NULL,
  payment_method    TEXT        NOT NULL DEFAULT 'bank_transfer',
  status            TEXT        NOT NULL DEFAULT 'pending',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES auth.users(id)
);

ALTER TABLE pending_verifications ENABLE ROW LEVEL SECURITY;
