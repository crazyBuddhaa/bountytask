-- ============================================================
-- BountyTask — Seed Data (Task Categories)
-- ============================================================

insert into public.task_categories (name, slug, description, icon, is_active) values
  ('Social Media', 'social-media', 'Like, follow, share, and engage on social platforms', '📱', true),
  ('Surveys & Reviews', 'surveys-reviews', 'Complete surveys and write product reviews', '📝', true),
  ('App Downloads', 'app-downloads', 'Download and install mobile applications', '📲', true),
  ('Video Watching', 'video-watching', 'Watch and engage with video content', '🎬', true),
  ('Website Visits', 'website-visits', 'Visit and interact with websites', '🌐', true),
  ('Data Collection', 'data-collection', 'Gather and submit data or information', '📊', true),
  ('Referrals', 'referrals', 'Refer new users to platforms or services', '🤝', true),
  ('Testing & QA', 'testing-qa', 'Test applications and report bugs', '🔍', true),
  ('Content Creation', 'content-creation', 'Create articles, photos, or other content', '✍️', true),
  ('Miscellaneous', 'miscellaneous', 'Other task types', '🎯', true);
