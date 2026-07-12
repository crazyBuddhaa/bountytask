-- Repurpose the verification-fee flow: it now gates withdrawals for an
-- existing account instead of gating account creation. pending_verifications
-- rows are now submitted by an already-authenticated user, so link them to
-- the real user id instead of only a denormalized email/full_name pair.
ALTER TABLE pending_verifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_pending_verifications_user ON pending_verifications(user_id);

-- referral_code is no longer relevant once the request happens post-signup.
ALTER TABLE pending_verifications ALTER COLUMN referral_code DROP NOT NULL;

-- A user can only have one non-rejected verification request in flight;
-- the email UNIQUE constraint from the old registration flow no longer
-- makes sense (same user can retry after a rejection under the same email).
ALTER TABLE pending_verifications DROP CONSTRAINT IF EXISTS pending_verifications_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_verifications_user_pending
  ON pending_verifications(user_id)
  WHERE status = 'pending';
