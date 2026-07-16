-- Global AI screenshot verification switch
INSERT INTO platform_settings (key, value) VALUES
  ('ai_verify_all_tasks', 'false')
ON CONFLICT (key) DO NOTHING;
