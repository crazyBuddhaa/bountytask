-- Prevents Paystack transaction-reference replay across both payment routes.
-- Previously, /api/verification/paystack and /api/advertiser/paystack only
-- checked Paystack's verify endpoint for `status: "success"` — they never
-- recorded that a reference had already been consumed. Since Paystack will
-- confirm success for a reference regardless of who submits it, any real
-- successful reference (the caller's own from an earlier payment, a friend's,
-- one scraped from a receipt) could be replayed to get verified for free, or
-- to mark unlimited advertiser submissions "paid" from a single real payment.

-- ── Advertiser submissions: one reference can pay for at most one submission ──
-- payment_reference is nullable (unpaid submissions have none); a plain UNIQUE
-- index still allows any number of NULLs, so unpaid rows are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_submissions_payment_reference_unique
  ON task_submissions(payment_reference)
  WHERE payment_reference IS NOT NULL;

-- ── Withdrawal verification fee: track every reference ever consumed ──────────
-- kyc_verified is a plain boolean with nowhere to record which reference paid
-- for it, so dedup needs its own table rather than a column-level constraint.
CREATE TABLE IF NOT EXISTS paystack_verification_references (
  reference   TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paystack_verification_references_user
  ON paystack_verification_references(user_id);

ALTER TABLE paystack_verification_references ENABLE ROW LEVEL SECURITY;
-- Only service role (admin client) accesses this table — no user-facing policy.
