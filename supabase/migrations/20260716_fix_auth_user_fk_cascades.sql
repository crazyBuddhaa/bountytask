-- Fix: all foreign keys that reference auth.users(id) without an ON DELETE
-- clause block Supabase from deleting auth users (the platform throws
-- "Database error deleting user"). Each column here falls into one of two
-- categories:
--
--   • user_id (the user's own data)   → ON DELETE CASCADE
--   • reviewed_by / updated_by        → ON DELETE SET NULL (nullable audit cols)
--
-- We drop the old auto-named constraint and re-add it with the correct clause.

-- ── 1. pending_verifications.user_id ─────────────────────────────────────────
-- This is the user's own verification request; delete it with the user.
ALTER TABLE pending_verifications
  DROP CONSTRAINT IF EXISTS pending_verifications_user_id_fkey;

ALTER TABLE pending_verifications
  ADD CONSTRAINT pending_verifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 2. pending_verifications.reviewed_by ─────────────────────────────────────
-- Nullable audit column pointing at the admin who reviewed. If that admin
-- account is ever deleted, just NULL the column — do not block the delete.
ALTER TABLE pending_verifications
  DROP CONSTRAINT IF EXISTS pending_verifications_reviewed_by_fkey;

ALTER TABLE pending_verifications
  ADD CONSTRAINT pending_verifications_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 3. platform_settings.updated_by ──────────────────────────────────────────
ALTER TABLE platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_updated_by_fkey;

ALTER TABLE platform_settings
  ADD CONSTRAINT platform_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 4. task_submissions.reviewed_by ──────────────────────────────────────────
ALTER TABLE task_submissions
  DROP CONSTRAINT IF EXISTS task_submissions_reviewed_by_fkey;

ALTER TABLE task_submissions
  ADD CONSTRAINT task_submissions_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 5. tiers.updated_by ──────────────────────────────────────────────────────
ALTER TABLE tiers
  DROP CONSTRAINT IF EXISTS tiers_updated_by_fkey;

ALTER TABLE tiers
  ADD CONSTRAINT tiers_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
