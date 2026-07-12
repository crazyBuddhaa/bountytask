-- Phone verification — gates the same event as the withdrawal fee (a user's
-- first withdrawal), not registration. Uses a short-lived OTP sent via
-- TextBee (SMS gateway) and verified against a hashed code.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL,
  code_hash   TEXT        NOT NULL,
  attempts    INT         NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_user ON phone_verification_codes(user_id);

ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;
-- Only service role (admin client) accesses this table — no user-facing policy.

INSERT INTO platform_settings (key, value) VALUES
  ('phone_verification_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
