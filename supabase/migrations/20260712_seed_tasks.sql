-- ============================================================
-- BountyTask — Seed Data (20 launch tasks)
-- Covers ad watching, social follows, referrals, surveys, app
-- downloads, website visits, data collection, and QA testing.
--
-- NOTE: verification_url values below are placeholders (BountyTask's
-- own social handles / example partner links) — replace them with your
-- real account URLs and partner offer links before going live. Reward
-- amounts are illustrative starting points in kobo (₦1 = 100 kobo);
-- adjust from Admin > Tasks (or Admin > Settings for policy-level caps)
-- to match your actual budget.
-- ============================================================

insert into public.tasks
  (title, description, instructions, category_id, type, status, reward_amount,
   max_completions, requires_proof, proof_instructions, time_limit_hours, verification_url)
values
  -- ── Video Watching (ads) ──────────────────────────────────
  ('Watch a Sponsored Video Ad',
   'Watch one short sponsored ad from start to finish.',
   'Tap the link below, watch the full ad without skipping, then mark this task complete.',
   (select id from public.task_categories where slug = 'video-watching'),
   'unverified', 'active', 2000, null, false, null, 1,
   'https://bountytask.ng/ads/sponsored-1'),

  ('Watch 3 Sponsored Ads Today',
   'Watch three short sponsored ads back to back.',
   'Open the ad hub, watch all 3 ads fully (about 90 seconds total), then mark this task complete.',
   (select id from public.task_categories where slug = 'video-watching'),
   'unverified', 'active', 5000, null, false, null, 2,
   'https://bountytask.ng/ads/daily-bundle'),

  ('Watch Our Product Explainer Video',
   'Watch a 2-minute video explaining how BountyTask works.',
   'Watch the full explainer video on YouTube, then mark this task complete.',
   (select id from public.task_categories where slug = 'video-watching'),
   'unverified', 'active', 2500, null, false, null, 1,
   'https://youtube.com/@BountyTaskNG'),

  -- ── Social Media (follow platforms) ───────────────────────
  ('Follow BountyTask on X (Twitter)',
   'Follow our official X account to stay updated on new tasks and payouts.',
   'Follow @BountyTaskNG on X, then upload a screenshot of your profile showing you now follow us.',
   (select id from public.task_categories where slug = 'social-media'),
   'verified', 'active', 5000, 2000, true,
   'Screenshot of your X profile showing "Following" on @BountyTaskNG', 24,
   'https://twitter.com/BountyTaskNG'),

  ('Follow BountyTask on Instagram',
   'Follow our Instagram page for tips and task announcements.',
   'Follow @BountyTaskNG on Instagram, then upload a screenshot showing you now follow us.',
   (select id from public.task_categories where slug = 'social-media'),
   'verified', 'active', 5000, 2000, true,
   'Screenshot of your Instagram profile showing "Following" on @BountyTaskNG', 24,
   'https://instagram.com/BountyTaskNG'),

  ('Like BountyTask on Facebook',
   'Like our Facebook page to stay in the loop.',
   'Like the BountyTask Facebook page, then upload a screenshot of your like.',
   (select id from public.task_categories where slug = 'social-media'),
   'verified', 'active', 5000, 2000, true,
   'Screenshot showing you liked the BountyTask Facebook page', 24,
   'https://facebook.com/BountyTaskNG'),

  ('Join Our WhatsApp Channel',
   'Join the official BountyTask WhatsApp channel for real-time task alerts.',
   'Tap the link, join the channel, then upload a screenshot showing you have joined.',
   (select id from public.task_categories where slug = 'social-media'),
   'verified', 'active', 5000, 2000, true,
   'Screenshot showing you joined the BountyTask WhatsApp channel', 24,
   'https://whatsapp.com/channel/BountyTaskNG'),

  ('Join Our Telegram Community',
   'Join our Telegram group to chat with other earners and get support.',
   'Tap the link, join the group, then upload a screenshot of your membership.',
   (select id from public.task_categories where slug = 'social-media'),
   'verified', 'active', 5000, 2000, true,
   'Screenshot showing you joined the BountyTask Telegram group', 24,
   'https://t.me/BountyTaskNG'),

  ('Subscribe to Our YouTube Channel',
   'Subscribe to our YouTube channel for tutorials and task walkthroughs.',
   'Subscribe to the channel, then upload a screenshot showing "Subscribed".',
   (select id from public.task_categories where slug = 'social-media'),
   'verified', 'active', 6000, 2000, true,
   'Screenshot showing "Subscribed" on the BountyTask YouTube channel', 24,
   'https://youtube.com/@BountyTaskNG'),

  -- ── Referrals (inviting users) ────────────────────────────
  ('Invite a Friend to BountyTask',
   'Share your referral link and get one friend to sign up and complete their first task.',
   'Copy your referral link from the Referrals page, send it to a friend, and have them sign up and complete one task. Then submit their username as proof.',
   (select id from public.task_categories where slug = 'referrals'),
   'verified', 'active', 10000, 5000, true,
   'Username or email of the friend who signed up with your referral link', 168,
   null),

  ('Invite 5 Friends This Month',
   'Grow your network — invite 5 people who sign up and complete at least one task this month.',
   'Share your referral link with 5 different people. Once all 5 have signed up and completed a task, submit their usernames as proof.',
   (select id from public.task_categories where slug = 'referrals'),
   'verified', 'active', 30000, 1000, true,
   'List the usernames or emails of all 5 referred friends', 720,
   null),

  ('Share BountyTask on Your WhatsApp Status',
   'Post about BountyTask on your WhatsApp status to spread the word.',
   'Put up a WhatsApp status mentioning BountyTask with your referral link, leave it up for at least 12 hours, then upload a screenshot.',
   (select id from public.task_categories where slug = 'referrals'),
   'verified', 'active', 4000, 3000, true,
   'Screenshot of your WhatsApp status mentioning BountyTask', 24,
   null),

  -- ── Surveys & Reviews ──────────────────────────────────────
  ('Complete a 5-Minute Consumer Survey',
   'Answer a short survey about your shopping habits.',
   'Open the survey link, answer all questions honestly, and submit the completion code shown at the end.',
   (select id from public.task_categories where slug = 'surveys-reviews'),
   'verified', 'active', 8000, 3000, true,
   'Completion code shown at the end of the survey', 24,
   'https://bountytask.ng/surveys/consumer-habits'),

  ('Rate & Review a Partner App',
   'Leave an honest rating and review for one of our partner apps.',
   'Download the app if needed, use it briefly, then leave a genuine star rating and written review on its app store page. Upload a screenshot of your published review.',
   (select id from public.task_categories where slug = 'surveys-reviews'),
   'verified', 'active', 7000, 2000, true,
   'Screenshot of your published review on the app store', 48,
   null),

  -- ── App Downloads ──────────────────────────────────────────
  ('Download & Install a Partner App',
   'Download, install, and open a featured partner app.',
   'Tap the link, install the app from the Play Store/App Store, open it once, then upload a screenshot of the installed app.',
   (select id from public.task_categories where slug = 'app-downloads'),
   'verified', 'active', 10000, 3000, true,
   'Screenshot of the installed app open on your device', 48,
   null),

  ('Try a Partner App for 3 Days',
   'Keep a featured partner app installed and active for 3 days.',
   'Install the app, use it at least once per day for 3 consecutive days, then upload a screenshot of your in-app activity/usage history.',
   (select id from public.task_categories where slug = 'app-downloads'),
   'verified', 'active', 15000, 1500, true,
   'Screenshot showing 3 days of activity inside the app', 96,
   null),

  -- ── Website Visits ─────────────────────────────────────────
  ('Visit Our Partner Website',
   'Browse a partner website for at least 2 minutes.',
   'Tap the link, spend at least 2 minutes browsing the site, then mark this task complete.',
   (select id from public.task_categories where slug = 'website-visits'),
   'unverified', 'active', 1500, null, false, null, 1,
   'https://bountytask.ng/partners/featured-site'),

  ('Sign Up on a Partner Website',
   'Create a free account on a featured partner website.',
   'Tap the link, register a free account using a valid email, then upload a screenshot of your account dashboard or welcome email.',
   (select id from public.task_categories where slug = 'website-visits'),
   'verified', 'active', 6000, 3000, true,
   'Screenshot of your new account dashboard or welcome email', 48,
   null),

  -- ── Data Collection ─────────────────────────────────────────
  ('Fill a Quick Data Form',
   'Share a few details about your city and interests to help us improve task targeting.',
   'Open the form, fill in your location and interests honestly, and submit it.',
   (select id from public.task_categories where slug = 'data-collection'),
   'unverified', 'active', 3000, null, false, null, 1,
   'https://bountytask.ng/forms/preferences'),

  -- ── Testing & QA ─────────────────────────────────────────────
  ('Report a Bug in the App',
   'Help us improve by finding and reporting a real bug or issue.',
   'Use the BountyTask app/site, find a genuine bug, and submit a clear description with steps to reproduce and a screenshot or screen recording.',
   (select id from public.task_categories where slug = 'testing-qa'),
   'verified', 'active', 15000, 500, true,
   'Bug description, steps to reproduce, and a screenshot or screen recording', 72,
   null);
