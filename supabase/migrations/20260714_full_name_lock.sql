-- Users may change their full name once after sign-up (e.g. to fix a typo or
-- use their preferred name), then it locks. Enforced server-side in
-- /api/profile — this column just tracks whether that one edit has been used.

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name_locked boolean NOT NULL DEFAULT false;
