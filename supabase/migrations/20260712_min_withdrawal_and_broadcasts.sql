-- Editable minimum withdrawal amount (kobo), managed via admin settings.
INSERT INTO platform_settings (key, value) VALUES
  ('min_withdrawal_kobo', '500000')
ON CONFLICT (key) DO NOTHING;

-- Allow admin broadcast notifications to carry a null ref (they aren't tied
-- to a specific task/withdrawal) and mark themselves distinctly in the UI.
-- No schema change needed for `notifications` — type is a free-form TEXT
-- column already, so "admin_broadcast" is a valid value out of the box.
