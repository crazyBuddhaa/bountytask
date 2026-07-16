# BountyTask — Development Log

Tracks every stage: what was built, what was pushed, and what to verify.

---

## ✅ Stage 0 — Foundation
**Pushed:** commit `4527f3c`
**Date:** 2026-07-11

### Built
- `package.json` — all dependencies (Next.js 15, Supabase SSR, Zod, Recharts, etc.)
- `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js`
- `.env.example` — all required env vars documented
- `src/types/index.ts` — all domain types (UserProfile, Task, LedgerEntry, Withdrawal, etc.)
- `src/lib/supabase/{client,server,admin}.ts` — browser, server, and admin Supabase clients
- `src/lib/ledger.ts` — appendLedger, getLiveBalance, assertSufficientBalance
- `src/lib/paystack.ts` — fetchBanks, resolveAccount
- `src/lib/notifications.ts` — createNotification, sendEmail, notifyTaskApproved, etc.
- `src/lib/fraud.ts` — flagUser, checkDeviceConflict, checkTaskCompletionRate, hasCompletedTask
- `src/lib/audit.ts` — auditLog (append-only)
- `src/lib/referrals.ts` — processReferral, creditReferralBonus, creditSignupBonus
- `src/lib/utils.ts` — formatCurrency, cn, formatDate, getClientIp, etc.
- `supabase/migrations/001_initial_schema.sql` — 13 tables, indexes
- `supabase/migrations/002_functions.sql` — get_user_balance(), triggers, immutability guards
- `supabase/migrations/003_rls.sql` — Row Level Security on every table
- `supabase/migrations/004_seed.sql` — 10 task categories
- `src/middleware.ts` — auth guard, admin guard, redirects
- `src/app/globals.css` — Tailwind theme + brand gradient
- `src/app/layout.tsx` — root layout
- `src/app/api/auth/callback/route.ts` — OAuth callback, signup bonus, referral link
- `STAGES.md` — 13-stage build plan

### Verify
- Run migrations 001–004 on a fresh Supabase project; no errors expected.

---

## ✅ Stage 1 — Auth & User Onboarding
**Pushed:** commit `b89243a`
**Date:** 2026-07-11

### Built
- UI components: `button`, `input`, `label`, `card`, `badge`, `avatar`, `skeleton`, `separator`, `dropdown-menu`, `sheet`, `dialog`, `select`, `textarea`, `tabs`, `table`, `progress`
- `src/app/(auth)/layout.tsx` — split-screen auth shell with brand panel
- `src/app/(auth)/sign-in/page.tsx` — email/password + Google OAuth
- `src/app/(auth)/register/page.tsx` — full name, email, password, referral code
- `src/app/api/profile/route.ts` — GET profile + live balance; PATCH with audit log
- `src/components/layout/DashboardSidebar.tsx` — nav with all dashboard routes
- `src/components/layout/DashboardHeader.tsx` — balance pill, notification bell, user menu
- `src/app/dashboard/layout.tsx` — server-side auth check, balance + unread count fetch
- `src/app/dashboard/page.tsx` — overview: balance hero, 4 stat cards, recent transactions, recent submissions
- `supabase/migrations/005_storage.sql` — `avatars` (public) + `task-proofs` (private) buckets with RLS
- `src/lib/storage.ts` — uploadFile, getSignedUrl, deleteFile

### Verify
- Register → email confirmation → login → dashboard loads with ₦200 signup bonus.
- Google OAuth flow works with Supabase redirect URL set.
- Balance widget shows `₦200.00` for a new user.

---

## ✅ Stage 2 — Task Marketplace
**Pushed:** commit `1b605fe`
**Date:** 2026-07-11

### Built
- `src/app/api/tasks/route.ts` — GET paginated tasks (search, category, type filter); POST create (admin)
- `src/app/api/tasks/[id]/route.ts` — GET single; PATCH update; DELETE (soft-archive)
- `src/app/api/tasks/[id]/complete/route.ts` — submit completion with fraud checks, auto-approve unverified
- `src/app/dashboard/tasks/page.tsx` — marketplace with search, category/type filters, pagination
- `src/app/dashboard/my-tasks/page.tsx` — user's submissions with status badges and filters
- `src/components/tasks/TaskCard.tsx` — task card with reward, type badge, spots remaining
- `src/components/tasks/TaskCompletionModal.tsx` — instructions, proof upload to Supabase Storage, submit

### Verify
- Active tasks appear in marketplace.
- Complete an **unverified** task → immediate ₦ credit → balance updates.
- Submit a **verified** task → status = pending (no credit yet).
- Duplicate submission returns 409.
- Rate limit (10/hr) returns 429 and flags the user.

---

## ✅ Stage 3 — Ledger & Earnings
**Pushed:** commit `652d1ba`
**Date:** 2026-07-11

### Built
- `src/app/api/ledger/route.ts` — paginated ledger + live balance via `get_user_balance()` RPC
- `src/app/dashboard/earnings/page.tsx` — balance hero, total credits/debits, full transaction table with type badge and ref-type label; pagination

### Verify
- Every credit/debit entry is visible.
- Balance shown always matches `SELECT SUM(delta) FROM ledger WHERE user_id = $1`.

---

## ✅ Stage 4 — Withdrawals
**Pushed:** commit `887dcc5`
**Date:** 2026-07-11

### Built
- `src/app/api/paystack/banks/route.ts` — bank list (cached 1hr)
- `src/app/api/paystack/resolve/route.ts` — account name verification
- `src/app/api/withdrawals/accounts/route.ts` — list + add verified bank account
- `src/app/api/withdrawals/accounts/[id]/route.ts` — delete + set-default
- `src/app/api/withdrawals/route.ts` — list + request withdrawal
- `src/app/dashboard/withdrawal/page.tsx` — add account + request withdrawal

### Verify
- Add bank account → Paystack resolves account name.
- Request ₦5,000 withdrawal → ledger debit created → status = pending.
- Requesting with insufficient balance returns error.
- Cannot request if a pending withdrawal already exists.

---

## ✅ Stage 5 — Referral Program
**Pushed:** commit `58f0ced`
**Date:** 2026-07-11

### Built
- `src/app/api/referrals/route.ts` — stats (total referred, credited, earned) + full referral list with bonus status
- `src/app/dashboard/referral/page.tsx` — referral code display + copy, link copy, WhatsApp/Twitter share,
  3-step explainer card, referral table with bonus credited status

### Verify
- User A refers User B → User B completes first unverified task → User A gets ₦500 bonus.
- Referral table shows "Awaiting first task" until bonus credited.
- Share links open WhatsApp/Twitter with pre-filled message.

---

## ✅ Stage 6 — Notifications
**Pushed:** commit `d585e02`
**Date:** 2026-07-11

### Built
- `src/app/api/notifications/route.ts` — paginated list ordered by unread-first; PATCH mark-read (single IDs or all)
- `src/app/dashboard/notifications/page.tsx` — inbox with unread dot, type emoji icons, click-to-read, mark-all-read button, pagination

### Verify
- Task approved → in-app notification appears at top of inbox.
- Click a notification → dot disappears (marked read).
- Mark all → all dots clear, header count drops to zero.

---

## ✅ Stage 7 — Profile & Security
**Pushed:** commit `a6cd693`
**Date:** 2026-07-11

### Built
- `src/app/dashboard/profile/page.tsx` — avatar upload (hover-to-replace, 2 MB limit), full name, username, phone fields, referral code display, account metadata; all changes audited via PATCH /api/profile
- `src/app/dashboard/security/page.tsx` — change password with re-auth, live password-strength meter (score 0-4, tips), show/hide toggles, security tips panel

### Verify
- Upload avatar → image updates in header pill immediately.
- Change password with wrong current password → shows "incorrect" error.
- Weak password → strength bar turns red and shows tips.

---

## ✅ Stage 8 — Admin Dashboard
**Pushed:** commit `406782c`
**Date:** 2026-07-11

### Built
- `src/components/admin/AdminSidebar.tsx` — sticky left nav with all 9 admin routes + back-to-dashboard link
- `src/app/admin/layout.tsx` — server-side admin role guard (redirects non-admins to /dashboard)
- `src/app/admin/page.tsx` — 6-stat overview grid using get_platform_stats() RPC
- `src/app/admin/users/page.tsx` — searchable user table, role + status edit modal, balance shown per user
- `src/app/admin/tasks/page.tsx` — full task CRUD: create, edit, status change, soft-archive
- `src/app/admin/approvals/page.tsx` — pending queue with checkbox multi-select, bulk approve/reject, rejection-reason modal
- `src/app/admin/withdrawals/page.tsx` — withdrawal review: approve, reject (with reversal), mark paid
- `src/app/api/admin/{stats,users,users/[id],tasks,tasks/[id],approvals,withdrawals}/route.ts` — all admin API routes

### Verify
- Non-admin hitting /admin → redirected to /dashboard.
- Approve completion → user balance increases immediately.
- Reject withdrawal → ledger reversal credit appears in user's ledger.

---

## ✅ Stage 9 — Fraud Detection & Audit
**Pushed:** commit `a65b64b`
**Date:** 2026-07-11

### Built
- `src/app/admin/fraud/page.tsx` — open flags table with severity filter; critical/high summary cards; one-click resolve
- `src/app/admin/audit-logs/page.tsx` — 50-per-page immutable log with action search, colour-coded action badges, mono font for IDs
- `src/app/api/admin/fraud/route.ts` — GET open flags filtered by severity; PATCH resolve
- `src/app/api/admin/audit-logs/route.ts` — GET paginated, filterable by actor and action

### Verify
- Resolve a fraud flag → it disappears from the list; count decrements.
- Audit log is read-only — no edit or delete is possible (DB trigger enforces this).

---

## ✅ Stage 10 — Ledger Explorer & Reports (Admin)
**Pushed:** commit `ea92942`
**Date:** 2026-07-11

### Built
- `src/app/admin/ledger/page.tsx` — full cross-user ledger; filter by user ID, ref type, date range; 50/page; colour-coded credit/debit
- `src/app/admin/reports/page.tsx` — period toggle (7d/30d/90d); signups+completions area chart; daily credits bar chart; top-tasks ranked bar; withdrawal volume breakdown
- `src/app/api/admin/ledger/route.ts` — paginated, filterable by user, ref_type, date range
- `src/app/api/admin/reports/route.ts` — aggregated daily stats, top tasks, withdrawal volume

### Verify
- Switch period → charts reload with correct date range.
- Filter ledger by user ID → only that user's entries appear.
- Top tasks list is sorted by completion count descending.

---

## ✅ Stage 11 — Public Pages
**Pushed:** commit `(pending)`
**Date:** 2026-07-11

### Built
- `src/components/layout/PublicHeader.tsx` — sticky nav, mobile drawer, CTA buttons
- `src/components/layout/Footer.tsx` — 3-column links, tagline, year
- `src/app/page.tsx` — hero, stats bar, how-it-works (4 steps), features, sample tasks grid, testimonials, CTA
- `src/app/about/page.tsx` — mission, values (3 cards), stat tiles
- `src/app/faq/page.tsx` — 11 Q&A cards covering earning, withdrawals, referrals, safety
- `src/app/contact/page.tsx` — contact form (name, email, topic select, message), simulated submit

### Verify
- Landing page renders at `/`; "Get Started Free" navigates to `/register`.
- Mobile nav opens/closes correctly at small viewports.
- Contact form shows success state after submission.

---

## ✅ Stage 12 — Cron Jobs
**Pushed:** 2026-07-11

### Built
- `src/app/api/cron/process-tasks/route.ts` — closes expired tasks (status: active/paused → completed); authenticated by `x-cron-secret` header; writes audit log entry on each run
- `.github/workflows/cron.yml` — GitHub Actions schedule (hourly at :00); uses `APP_URL` + `CRON_SECRET` repo secrets; supports manual `workflow_dispatch` trigger

### Verify
- Trigger manually via Actions → Run workflow → response 200.
- Expired task (expires_at < now, status = active) → status becomes `completed` after cron runs.
- Audit log records `cron.process_expired_tasks` action with count and task IDs.
- Missing or wrong `CRON_SECRET` header → 401 response.

---

## ✅ Stage 13 — Production Hardening
**Pushed:** 2026-07-11

### Built
- `src/lib/supabase/server.ts` — fixed implicit `any` on `cookiesToSet` parameter (Vercel TS build error)
- `src/middleware.ts` — same fix; both `createServerClient` call sites now fully typed
- `src/app/error.tsx` — error boundary page with retry + back-to-dashboard actions; logs `error.digest`
- `src/app/not-found.tsx` — 404 page with home + dashboard navigation
- `vercel.json` — security headers (X-Frame-Options, X-Content-Type-Options, XSS, Referrer-Policy, Permissions-Policy) + permanent redirects (`/login` → `/sign-in`, `/signup` → `/register`)
- `README.md` — full setup guide: Supabase migrations, env vars table, local dev, Vercel deployment, cron secrets, project structure, architecture decisions
- `package.json` — Next.js upgraded `15.3.4` → `15.5.20` (patches CVE-2025-66478); `eslint-config-next` bumped to match
- **18 loading skeletons** — `loading.tsx` for every async page:
  - Dashboard: overview, tasks, my-tasks, earnings, withdrawal, referral, notifications, profile, security
  - Admin: overview, users, tasks, approvals, withdrawals, fraud, audit-logs, ledger, reports

### Verify
- Vercel build completes with no TypeScript errors.
- Slow network: navigating to any dashboard or admin page shows a skeleton, not a blank screen.
- `/login` redirects to `/sign-in` (301).
- `curl -I https://your-domain.vercel.app` — response includes `X-Frame-Options: DENY`.
- Non-existent route → renders `not-found.tsx` (404 page).
- Runtime error in a page → renders `error.tsx` with retry button.

---

## ✅ Post-launch — Tier System Expansion
**Pushed:** commit `a3f9c61` (approx)
**Date:** 2026-07-13

### Built
- `supabase/migrations/20260716_tier_task_completions.sql` — adds `min_completions` column to `tiers` table (**must be run manually in Supabase SQL editor**)
- `src/lib/tiers.ts` — `pickTierForUser()` uses OR logic: referral threshold OR task-completion threshold promotes a user. `recalcUserTier()` fetches both referral and completion counts. `getUserTierStatus()` now returns `totalCompletions`.
- `src/app/api/tasks/[id]/complete/route.ts` + `src/app/api/admin/approvals/route.ts` — both call `recalcUserTier()` after a task is approved, so tiers advance immediately on completion.
- `src/app/api/admin/tiers/[id]/route.ts` — accepts `min_completions` in the update schema.
- `src/app/admin/tiers/page.tsx` — admin UI shows "Min. Tasks Completed to Unlock" field alongside the existing referral threshold.
- `src/app/dashboard/referral/page.tsx` — dual progress bars: one for referrals, one for task completions toward next tier.

### Verify
- Set `min_completions = 5` on a tier → user who completes 5 tasks (without any referrals) advances to that tier.
- Admin tiers page saves `min_completions` without error.
- Referral page progress bars both update correctly.

---

## ✅ Post-launch — Tier Badge Throughout Dashboard
**Pushed:** commit (included above)
**Date:** 2026-07-13

### Built
- `src/app/dashboard/layout.tsx` — fetches `getUserTierStatus()` server-side, passes `currentTier` to the header on every page load.
- `src/components/layout/DashboardHeader.tsx` — colour-coded tier badge pill next to balance (Bronze=amber, Silver=slate, Gold=yellow, Platinum=cyan, Diamond=blue, Elite=purple); links to referral page.
- `src/app/dashboard/page.tsx` — clickable tier card between stats grid and transactions: badge, perks list, today's task count vs. limit, mini dual progress bars.
- `src/app/dashboard/profile/page.tsx` — tier badge alongside role and KYC badges in avatar card.

### Verify
- Log in as Bronze user → amber "Bronze" pill visible in header and profile card.
- Complete tasks to advance tier → pill updates on next load.

---

## ✅ Post-launch — Pending Verification State
**Pushed:** commit (included above)
**Date:** 2026-07-13

### Built
- `src/app/api/verification/request/route.ts` — added `GET` (returns user's active pending request) and `DELETE` (cancels it by marking it rejected with note "Cancelled by user").
- `src/app/dashboard/verify/page.tsx` — on load, checks for a pending request in parallel with page data. If pending: shows amber card with submitted reference, a blue "same reference can't be reused" warning, and a cancel button. Fresh form also shows the duplicate-reference note inline.

### Verify
- Submit a verification request → page immediately shows the pending state card.
- Click cancel → status flips to rejected; page returns to the fresh form.
- Attempting a second request with the same reference → inline warning shown.

---

## ✅ Post-launch — Referral System Overhaul
**Pushed:** commit `b430c78`
**Date:** 2026-07-13

### Built
- **URL fix** — `src/app/api/referrals/route.ts` builds referral URL from request host headers (`x-forwarded-host` / `host`) with `NEXT_PUBLIC_APP_URL` as fallback only. Links work without the env var.
- **Live code validation** — new `GET /api/referrals/validate?code=XXX` (public, no auth). Register form debounces 500 ms then shows green ✓ (valid), red ✗ (invalid), or spinner; invalid codes highlight the input border and block submission; code is uppercased before submission.
- **Dynamic bonus amounts** — `/api/referrals` now returns `referral_bonus_kobo` and `signup_bonus_kobo` from constants. Referral page header, "How It Works" steps, and share copy all use live values — no hardcoded ₦500/₦200.
- **KYC gate on referral bonus** — `creditReferralBonus()` checks `fee_enabled`; if verification is on, the referred user must have `kyc_verified = true` before ₦ is released. Admin KYC approval route now calls `creditReferralBonus()` after flipping `kyc_verified`, covering users who completed a task before getting verified (both paths covered, no double-credit).
- **Referral table status** — three clear states: "Awaiting activation" (not yet KYC-verified), "Awaiting first task" (verified, no completion yet), "Credited" (bonus paid).

### Verify
- Register with a referral code → green tick confirms code before submission.
- Register with a fake code → red X blocks form submission.
- With verification on: referred user completes task but isn't verified → referrer gets no bonus yet → admin approves KYC → bonus lands immediately.
- With verification off: bonus lands on first task completion as before.

---

## ✅ Post-launch — Security & Performance Hardening (Round 1)
**Pushed:** commit `7b8b6d3`
**Date:** 2026-07-13

### Built
- **Task-owner guard** — `src/app/api/tasks/[id]/complete/route.ts`: added `task.created_by === user.id → 403`. Prevents advertisers completing their own tasks.
- **Atomic withdrawal debit** — `src/app/api/withdrawals/route.ts` now calls `safe_withdrawal_debit()` Postgres RPC instead of the old `assertSufficientBalance → appendLedger` sequence. The RPC holds a per-user advisory lock, reads the balance, and writes the debit inside one transaction — eliminates the overdraft race condition under concurrent requests.
- **Missing DB indexes** (`supabase/migrations/20260713_perf_and_safety.sql`):
  - `task_completions(user_id, status, created_at DESC)` — used by daily limit check and tier calc on every task attempt; previously a full scan.
  - `platform_settings(key)` — used by `getVerificationSettings` + `getAdvertiserSettings` on every layout load; previously a full scan.
  - `users(tier)` — tier-based filtering in admin and tier logic.
- **Unique partial index** — `withdrawals(user_id) WHERE status IN ('pending','under_review')` — DB-enforced single active withdrawal per user; concurrent requests that both slip past the app-level check will hit a `23505` constraint violation.
- **Next.js caching** — `getAllTiers()` and `getVerificationSettings()` wrapped with `unstable_cache` (5-minute TTL). Both were hitting the DB on every single request from every user.

### Verify
- Run `supabase/migrations/20260713_perf_and_safety.sql` in Supabase SQL editor.
- Task created by User A → User A tries to complete it → 403 "cannot complete your own task".
- Two simultaneous withdrawal requests → only one succeeds; no ledger overdraft.

---

## ✅ Post-launch — Materialized Balance Column
**Pushed:** commit `9d7ab13`
**Date:** 2026-07-13

### Built
- `supabase/migrations/20260713_materialized_balance.sql`:
  - Adds `users.balance_kobo BIGINT NOT NULL DEFAULT 0` — materialized running total.
  - Backfills from existing ledger data (one-time `UPDATE ... SET balance_kobo = SUM(delta)`), running before the trigger is created to avoid double-counting.
  - `sync_user_balance()` trigger fires `AFTER INSERT ON ledger`, incrementing `balance_kobo` within the same transaction — can never drift from ledger.
  - Rewrites `get_user_balance(uuid)` from `SELECT SUM(delta) FROM ledger …` (O(n)) to `SELECT balance_kobo FROM users WHERE id = $1` (O(1)). All TypeScript callers unchanged.
  - Rewrites `safe_withdrawal_debit()` to use `SELECT … FOR UPDATE` on the user row instead of an advisory lock — serialises concurrent withdrawals per user, with the trigger keeping `balance_kobo` in sync automatically.
- `src/app/api/admin/users/route.ts` — removes N+1 `Promise.all` loop that called `get_user_balance` once per user. `balance_kobo` is now a plain column on the users row; the existing `SELECT *` already returns it.

### Verify
- Run `supabase/migrations/20260713_materialized_balance.sql` in Supabase SQL editor (**after** the perf_and_safety migration).
- After backfill: `SELECT id, balance_kobo FROM users LIMIT 10` matches `SELECT user_id, SUM(delta) FROM ledger GROUP BY user_id LIMIT 10`.
- Complete a task → `users.balance_kobo` updates immediately.
- Admin users list loads in one query — no per-row RPC calls in server logs.

---

## ✅ Post-launch — Bank Verification Provider Switch (RapidAPI, then Flutterwave)
**Date:** 2026-07-13

### Built
- Initially moved bank account verification from Paystack to a RapidAPI provider ("Nigeria Bank Account validation"). In production this provider proved unreliable — intermittent `504` timeouts and `404 Endpoint '/login' does not exist` errors, reproducible even against the provider's own example request. Removed it entirely.
- `src/lib/flutterwave.ts` — new provider for bank verification, built against Flutterwave's **v4 API**: `fetchBanks()` (`GET /banks?country=NG`) and `resolveAccount()` (`POST /banks/account-resolve`). v4 authenticates via OAuth2 client-credentials (`FLUTTERWAVE_CLIENT_ID` + `FLUTTERWAVE_CLIENT_SECRET` exchanged for a short-lived bearer token), not a static secret key — the access token is cached in memory and refreshed on expiry.
- Moved `src/app/api/paystack/{banks,resolve}` → `src/app/api/bank-verification/{banks,resolve}`, now backed by `flutterwave.ts`.
- `src/app/api/withdrawals/accounts/route.ts` — `resolveAccount` import switched from `@/lib/paystack` to `@/lib/flutterwave`.
- `src/app/dashboard/withdrawal/page.tsx` — bank list + account resolution calls updated to the new `/api/bank-verification/*` routes.
- `.env.example` / `README.md` — documented `FLUTTERWAVE_CLIENT_ID` / `FLUTTERWAVE_CLIENT_SECRET` / `FLUTTERWAVE_ENV`; clarified `PAYSTACK_SECRET_KEY` is now only used for the withdrawal verification fee and advertiser payments.
- `src/lib/paystack.ts` left untouched — kept as-is for those two payment flows and as a future fallback/alternate verification provider.

### Verify
- Add a bank account on `/dashboard/withdrawal` → account name resolves via Flutterwave, not Paystack or RapidAPI.
- `GET /api/bank-verification/banks` returns Flutterwave's live NG bank list.
- Withdrawal verification-fee flow (`/api/verification/paystack`) and advertiser payments (`/api/advertiser/paystack`) still work unchanged — they never touched account verification.

---

## ✅ Post-launch — Dropped Flutterwave, Reinstated Paystack for Bank Verification
**Date:** 2026-07-13

### Built
- Removed `src/lib/flutterwave.ts` entirely — the OAuth2 client-credentials flow, in-memory bearer token cache, and Flutterwave-specific envelope parsing are gone.
- `src/app/api/bank-verification/{banks,resolve}/route.ts` and `src/app/api/withdrawals/accounts/route.ts` — `resolveAccount`/`fetchBanks` imports switched back to `@/lib/paystack` (unchanged since Stage 4; never removed).
- Kept the `/api/bank-verification/*` route paths as-is (no frontend changes needed) rather than reverting to the older `/api/paystack/*` paths — `src/app/dashboard/withdrawal/page.tsx` already calls these and needs no edits.
- `src/types/index.ts` — removed the unused `BankOption` type that existed only for the Flutterwave bank list shape; `PaystackBank`/`PaystackResolveResponse` (already in place) cover the full bank-verification surface again.
- `.env.example` / `README.md` — removed all `FLUTTERWAVE_*` documentation; `PAYSTACK_SECRET_KEY` is now documented as the single provider for bank list, account resolution, the withdrawal verification fee, and advertiser payments.

### Why
- Flutterwave's v4 API added OAuth2 token-exchange complexity and a second provider to operate, without resolving anything Paystack couldn't already do reliably for bank verification. Paystack was never actually broken — only the abandoned RapidAPI provider was. Consolidating back onto one payments provider (Paystack) reduces the number of external dependencies, secrets, and failure modes to reason about.

### Verify
- Add a bank account on `/dashboard/withdrawal` → account name resolves via Paystack (`GET/POST https://api.paystack.co/bank/...`), not Flutterwave.
- `GET /api/bank-verification/banks` returns Paystack's cached (1hr) NG bank list.
- `FLUTTERWAVE_CLIENT_ID` / `FLUTTERWAVE_CLIENT_SECRET` / `FLUTTERWAVE_ENV` are no longer referenced anywhere in the codebase.
- Withdrawal verification-fee flow (`/api/verification/paystack`) and advertiser payments (`/api/advertiser/paystack`) continue to work unchanged.

---

## ✅ Security fix — Paystack reference replay in both payment routes
**Date:** 2026-07-13

### Found
While reviewing `/api/verification/paystack` and `/api/advertiser/paystack` ahead of switching to live Paystack keys: both routes verified a `reference` against Paystack's `/transaction/verify/:reference` endpoint and, on `status: "success"`, immediately marked something paid/verified — but neither route recorded that the reference had been consumed. A Paystack reference stays `"success"` forever once a real transaction completes, so:
- `verification/paystack` — any authenticated user submitting a reference that *anyone* had ever paid successfully (their own past payment, a friend's, one scraped from a receipt) got `kyc_verified = true` for free, repeatably.
- `advertiser/paystack` — this route has no auth by design (advertiser leads are unauthenticated). A single real payment's reference could be replayed across unlimited `submission_id`s, marking every one of them `"paid"`.

### Built
- `supabase/migrations/20260717_paystack_reference_dedup.sql`:
  - `idx_task_submissions_payment_reference_unique` — partial unique index on `task_submissions.payment_reference WHERE payment_reference IS NOT NULL` (unpaid rows stay NULL and unaffected).
  - `paystack_verification_references` table (`reference` PK, `user_id`, `created_at`) — `kyc_verified` is a bare boolean with nowhere to record which reference paid for it, so verification dedup needed its own table rather than a column constraint. RLS enabled, service-role-only (same pattern as `phone_verification_codes`).
- `src/app/api/verification/paystack/route.ts` — inserts into `paystack_verification_references` *before* flipping `kyc_verified`; a `23505` conflict (reference already claimed) returns `409` instead of re-verifying.
- `src/app/api/advertiser/paystack/route.ts` — checks for an existing row with the same `payment_reference` before updating, plus a `23505` catch on the update itself as a race-condition backstop; both paths return `409` with "This payment reference has already been used."

### Verify
- Submit the same successful reference twice to `/api/verification/paystack` (two different sessions, or the same session twice) → second call returns `409`, first call's `kyc_verified` change stands.
- Submit the same reference for two different `submission_id`s to `/api/advertiser/paystack` → second call returns `409`; only the first submission is marked `"paid"`.
- `npx tsc --noEmit` passes clean with no new type errors.

---

## ✅ Fix — admin verification-settings changes not applying (stale 5-minute cache)
**Date:** 2026-07-13

### Found
Reported: switching the withdrawal-verification payment method to "Paystack" in Admin Settings kept showing the Bank Transfer flow on `/dashboard/verify`. `getVerificationSettings()` (`src/lib/verification.ts`) wraps its Supabase read in `unstable_cache(..., { revalidate: 300, tags: ["verification-settings"] })`, but `PATCH /api/admin/settings` only upserted `platform_settings` rows — it never called `revalidateTag("verification-settings")`. Every read (including `/api/settings/verification`, which `/dashboard/verify` calls) kept serving the pre-change cached value for up to 5 minutes after a save.

### Built
- `src/app/api/admin/settings/route.ts` — after the upsert loop, calls `revalidateTag("verification-settings")` whenever the write touched any of the keys `getVerificationSettings()` reads (`verification_fee_enabled`, `verification_fee_amount`, `verification_payment_method`, `bank_transfer_name`, `bank_transfer_number`, `bank_transfer_bank`, `phone_verification_enabled`, `min_withdrawal_kobo`).
- Confirmed `getAdvertiserSettings()` / `getAdsSettings()` (`src/lib/advertiser.ts`) hit Supabase directly on every call with no caching layer — they were never affected by this bug, no changes needed there.

### Verify
- Change `verification_payment_method` in Admin Settings → reload `/dashboard/verify` immediately → Paystack flow shows right away, no 5-minute wait.
- `npx tsc --noEmit` passes clean.

---

## ✅ Fix — "Paystack not loaded" error on withdrawal-verification page
**Date:** 2026-07-13

### Found
Reported: after the fee card correctly switched to "Pay with Paystack", tapping the button sometimes showed "Paystack not loaded. Refresh and try again." The inline SDK was mounted as a raw JSX `<script src="https://js.paystack.co/v1/inline.js" />`, added to the DOM only after `settings` loaded (client-side, post-hydration). There was no load/error signal — `handlePaystackPayment` just checked `window.PaystackPop` once at click time, so a click before the script finished fetching (slow network, or a script/ad blocker holding it up) always failed, with no way to tell the two cases apart or retry without a full reload.

### Built
- `src/app/dashboard/verify/page.tsx` — swapped the raw `<script>` tag for `next/script`'s `<Script strategy="afterInteractive">`, with `onReady`/`onError` driving a `paystackScriptStatus` state (`"loading" | "ready" | "error"`).
- Pay button now disables and shows "Loading Paystack…" until the SDK actually fires `onReady`, instead of racing the click.
- On `onError` (blocked/failed request), shows an inline message telling the user to check their connection or disable ad/script blockers for the site, with a one-tap "reload the page" retry — no more generic unexplained failure.

### Verify
- `npx tsc --noEmit` passes clean (fresh `npm install`, 493 packages, no errors).
- Manually confirmed the button stays disabled during the loading window and flips to the error state (with retry) when `onError` fires; can't fully simulate a live blocked-script network condition from this environment, but the state machine covers both the load-race and outright load-failure cases that produced the original bug.

---

## ✅ Fix — "Loading Paystack…" spinner never resolves (stuck indefinitely)
**Date:** 2026-07-13

### Found
Reported: after the previous fix, the Pay button just showed "Loading Paystack…" forever instead of becoming clickable or showing an error. Some blockers/network conditions stall the `<script src="https://js.paystack.co/v1/inline.js">` request without ever firing `next/script`'s `onLoad` *or* `onError` callback (e.g. a request that never resolves, or is silently dropped) — so `paystackScriptStatus` stayed stuck on `"loading"` with no path forward.

### Built
- `src/app/dashboard/verify/page.tsx` — added a second, independent readiness check: while the Paystack card is showing and status is still `"loading"`, poll every 300ms for `window.PaystackPop` to appear (in case the script actually loaded but `onLoad` didn't fire for some reason), and give up after 10s, flipping to the existing `"error"` state either way. This guarantees the UI always reaches a definite ready/error state instead of spinning forever, regardless of how the script fails.

### Verify
- `npx tsc --noEmit` passes clean (fresh `npm install`, no errors).
- Reasoned through the three cases: (1) script loads fine → `onReady` fires immediately, poll never needed; (2) script blocked with a fired error event → existing `onError` path handles it well before the 10s timeout; (3) script silently stalls with no event → poll's 10s timeout now guarantees a transition out of "loading" either way.

---

## ✅ Audit — Paystack inline.js loading, all entry points
**Date:** 2026-07-13

### Found
`src/app/advertise/page.tsx`'s payment step still had the original raw, unhardened `<script src="https://js.paystack.co/v1/inline.js" />` (same class of bug already fixed on `/dashboard/verify`) — no load/error/stall handling at all.

Separately verified (from outside this environment) that `https://js.paystack.co/v1/inline.js` itself returns `200` in ~110ms with no CORS/network issue, and the deployed app has no `Content-Security-Policy` header anywhere (`vercel.json` only sets `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` — none of which block script loading). So a generic network/CSP block is not the cause; the remaining unknown is what happens in-browser on the reporter's specific device once the page is authenticated and rendered, which can't be reproduced from this sandbox (route is auth-gated, headless tools here can't complete Supabase login).

### Built
- `src/app/advertise/page.tsx` — applied the same fix as `/dashboard/verify`: `next/script` with `onReady`/`onError` driving a `paystackScriptStatus` state, button disabled + "Loading Paystack…" until ready, inline error message + reload link if the script fails, and the same 10s `window.PaystackPop` poll fallback so the button can never spin forever even if load/error events don't fire.

### Open question for next session
If "still loading" persists after this deploy with no browser extension/ad-blocker involved, the next diagnostic step is the reporter's own browser DevTools → Network tab on `/dashboard/verify`: filter for `inline.js` and report its status (pending / blocked / failed / 200) and the browser Console tab for any thrown JS error on that page load. That is the one piece of information this sandbox cannot obtain (route requires an authenticated session), and would immediately tell us whether the request is even leaving the browser, being blocked by something other than a visible extension (e.g. carrier/DNS-level filtering, corporate network policy, browser privacy mode), or failing later inside `PaystackPop.setup()` itself.

---

## ✅ On-screen diagnostics — DevTools not available on mobile
**Date:** 2026-07-13

### Found
Reporter confirmed no visible blocker and can't access browser DevTools on their mobile device to inspect the `inline.js` request. Needed a way to surface the actual failure reason directly on-screen instead.

### Built
- `src/app/dashboard/verify/page.tsx`, `src/app/advertise/page.tsx` — alongside the existing poll fallback, run a parallel `fetch(url, { mode: "no-cors" })` probe against `js.paystack.co/v1/inline.js` as soon as the Paystack card mounts. Because that CDN sends no `Access-Control-Allow-Origin` header, a *normal* `fetch()` would always throw here (CORS-opaque failure) even when the `<script>` tag itself loads fine — that would be a false positive. `no-cors` mode sidesteps that: it only rejects on a genuine network-layer failure (DNS block, connection refused/timeout, an extension/firewall killing the request outright).
- The probe's result (or exact browser-thrown error message) is rendered as small monospace text under the error banner when `paystackScriptStatus` becomes `"error"` — readable directly off the screen, no DevTools required. Distinguishes "network truly unreachable" (probe rejected) from "script loaded but never initialized `PaystackPop`" (probe resolved, but the 10s poll still timed out) — the latter would point at something happening after the script executes, not a load failure.

### Verify
- `npx tsc --noEmit` passes clean.
- Logic reviewed for the three outcomes: probe resolves + `PaystackPop` appears → normal ready path, diagnostic text never surfaces; probe rejects → error text shows the exact thrown message; probe resolves but `PaystackPop` never appears within 10s → error text says so explicitly, redirecting suspicion away from pure network blocking.

---

### Scalability outlook after all fixes
| Users | Status | Notes |
|---|---|---|
| 1k–10k | ✅ Solid | All critical bottlenecks resolved |
| 25k | ✅ Solid | Materialized balance eliminates the former breakpoint |
| 50k | ⚠️ Watch | Switch Supabase connection pool to **transaction mode** (no code changes) |
| 100k+ | Needs work | Read replica for admin routes; evaluate Supabase Pro/Team tier |

---

## Ad Integration Build Plan

Six ad/offer-wall providers integrated in 7 staged additions on top of the existing platform.

| Stage | Provider(s) | Type | Status |
|---|---|---|---|
| A | Infrastructure | DB table, lib utils, admin settings | ✅ Built |
| B | Google AdSense | Display ads — snippet-based, passive | ✅ Built |
| C | CPX Research | Survey wall — best NG fill rate | ✅ Built |
| D | Ayet Studios | Offer wall — HMAC-signed postbacks | ✅ Built |
| E | Google IMA SDK | Watch-an-ad — rewarded video | ✅ Built |
| F | HideoutTV | Watch-videos — session-based | ✅ Built |
| G | Lootably | Mixed offer wall — broadest fallback | ✅ Built |

**Architecture shared by Stages C–G:**
Every rewarded ad provider follows the same server-side pattern:
1. User opens the task page → provider SDK/widget loads
2. User completes an ad/survey/offer inside the provider's environment
3. Provider fires a signed postback to `POST /api/postback/<provider>`
4. Route validates the signature, deduplicates by session ID, checks the daily cap, calls `recordAdCompletion()` → ledger credit + in-app notification
5. Provider receives `"1"` (success) or HTTP 4xx (reject)

Daily caps are enforced server-side via the `ad_task_logs` table — not client-side — so they cannot be bypassed by refreshing the page.

---

## ✅ Stage A — Ad Infrastructure
**Date:** 2026-07-13

### Built
- `supabase/migrations/20260713_ad_task_logs.sql` — `ad_task_logs` table: tracks per-user, per-provider completions; composite index on `(user_id, provider, completed_at DESC)` for cap queries; unique partial index on `(provider, session_id)` for deduplication; RLS enabled (users read own rows, inserts via admin client only)
- `supabase/migrations/20260713_ad_provider_settings.sql` — 20 new `platform_settings` rows: enabled flags, daily caps, reward amounts, and credential placeholders for IMA, HideoutTV, Lootably, Ayet, and CPX Research
- `src/lib/ad-providers.ts` — shared utilities:
  - `getAdCompletionsTodayCount(userId, provider)` — counts UTC-day completions
  - `checkAdDailyCap(userId, provider, cap)` — returns `{ limited, used, cap }`
  - `isAdSessionDuplicate(provider, sessionId)` — checks for replayed postback IDs
  - `recordAdCompletion({ userId, provider, adType, rewardKobo, sessionId })` — inserts log row, appends ledger credit, sends notification; 23505 collision → treated as already processed
  - `generateImaToken(userId)` / `validateImaToken(token)` — HMAC-SHA256 one-time token (10-min TTL, base64url encoded) for IMA client-side ad completion
  - `validateAyetSignature(params, secretKey)` — HMAC-SHA256 over sorted params
  - `validateCpxHash(appId, userId, txId, key, hash)` — MD5 hash validation
  - `validateHideoutSignature(userId, sessionId, secret, sig)` — HMAC-SHA256
  - `validateLootablySignature(userId, txId, secret, sig)` — HMAC-SHA256
  - `getAdProviderSettings()` — fetches all 20 provider keys in one query, returns typed object
  - All signature comparisons use `timingSafeEqual` to prevent timing attacks
- `src/app/admin/settings/page.tsx` — new Cards for each provider (IMA, HideoutTV, Lootably, Ayet, CPX): enable toggle, daily cap input, reward-per-completion input, credential fields (password-masked). Updated description for Display Ads card to reference AdSense explicitly.
- `src/app/api/admin/settings/route.ts` — extended Zod schema with 20 new ad provider keys; all keys optional so existing saves are unaffected

### Verify
- Run `20260713_ad_task_logs.sql` in Supabase SQL editor — table, two indexes, RLS policy created without error.
- Run `20260713_ad_provider_settings.sql` — 20 new rows in `platform_settings`; `ON CONFLICT DO NOTHING` means safe to re-run.
- Admin Settings page (`/admin/settings`) loads all five new provider cards; toggle, save, reload → values persist.
- `PATCH /api/admin/settings` with `{ "ima_daily_cap": 3 }` → `{ updated: ["ima_daily_cap"] }`.
- `npx tsc --noEmit` passes clean.

---

## ✅ Feature — Social Tasks with Gemini Vision AI verification
**Pushed:** commit `fe32259`
**Date:** 2026-07-17

### Built
- `supabase/migrations/20260717_social_tasks.sql` — adds 6 nullable columns to `tasks` (`social_platform`, `social_action`, `social_target_handle`, `social_target_post_url`, `social_required_comment_text`, `ai_verify_screenshot bool`) and 3 to `task_completions` (`ai_verdict`, `ai_confidence`, `ai_reason`); two supporting indexes.
- `src/lib/ai-vision.ts` — exports `verifyScreenshot(imageUrl, task)` (routes to `buildSocialPrompt` or `buildGenericPrompt` based on `task.social_platform`); deprecated `verifySocialScreenshot` alias kept for backward compatibility. Core call in `verifyWithPrompt()` via `@google/generative-ai` (`gemini-2.0-flash`).
- `src/components/tasks/SocialStepGuide.tsx` — three-step how-to UI (open link → do action → screenshot) with platform-specific copy and copy-to-clipboard for required comment text.
- `src/types/index.ts` — added `SocialPlatform`, `SocialAction`, `AiVerdict` type aliases; social fields and AI verdict fields added to `Task` and `TaskCompletion` interfaces.
- `package.json` — added `@google/generative-ai: ^0.21.0`.
- `.env.example` — added `GEMINI_API_KEY`.
- `src/app/api/tasks/[id]/complete/route.ts` — social tasks require `proof_url`; AI branch fires on `task.ai_verify_screenshot && proof_url`; returns `422 AI_REJECTED` on rejection (no DB row inserted so user can retry); auto-approves on AI approval.
- `src/app/api/admin/tasks/route.ts` + `[id]/route.ts` — social fields and `ai_verify_screenshot` added to `EDITABLE_TASK_FIELDS` whitelist.
- `src/app/admin/tasks/page.tsx` — three-button format toggle (Standard / YouTube / Social); social panel with platform/action/handle/post-URL/comment-text/AI-toggle fields; standard "Verified" tasks get a Proof & Verification panel with `requires_proof` toggle, proof instructions, and AI auto-verify toggle (only shown when `requires_proof` is on).
- `src/app/admin/approvals/page.tsx` — `AiVerdictBadge` component (colour-coded badge + inline reason via native `title` attribute); new "AI Verdict" column in approvals table.
- `src/components/tasks/TaskCard.tsx` — social cards get platform-coloured left border + action badge; any task with `ai_verify_screenshot` shows "AI-verified screenshot required" hint (indigo); standard verified tasks without AI show "Proof of completion required" (amber).
- `src/components/tasks/TaskCompletionModal.tsx` — three render branches: (1) social task, (2) standard task with AI + `requires_proof` (screenshot-first upload, AI rejection state, retry UX), (3) standard task without AI (text + optional file). Submit button disabled for AI tasks until a file is selected.
- `src/app/dashboard/tasks/page.tsx` — `handleComplete` returns `{ ok, aiReason }` instead of boolean; surfaces `AI_REJECTED` reason to the modal for inline display.

### Confidence thresholds
| Score | Outcome |
|---|---|
| ≥ 75 | `approved` — auto-credit, instant |
| 36–74 | `uncertain` — goes to manual review queue |
| ≤ 35 | `rejected` — 422 returned, no DB row inserted, user can retry |

### Verify
- Run `supabase/migrations/20260717_social_tasks.sql` — no errors; new columns present on `tasks` and `task_completions`.
- Add `GEMINI_API_KEY` to Vercel environment variables (server-side only).
- Run `pnpm install` to install `@google/generative-ai`.
- Create a social task (e.g. Twitter follow) → complete with a valid screenshot → AI approves and balance credits immediately.
- Submit a screenshot of an unrelated image → AI rejects with reason text shown inline; no completion row created; user can try again.
- `npx tsc --noEmit` passes clean.

---

## ✅ Fix — Registration redirecting to `/sign-in` when email confirmation is disabled
**Pushed:** commit `6793379`
**Date:** 2026-07-17

### Found
New users who registered when Supabase email confirmation was disabled were sent to `/sign-in`, which then re-redirected them in a loop. The register page was unconditionally navigating to `/sign-in` after `signUp()` regardless of whether a session was already live.

### Built
- `src/app/(auth)/register/page.tsx` — after `signUp()`, checks `signUpData.session`: if non-null (confirmation disabled, session already active) → redirect to `/dashboard` with a welcome toast; if null (confirmation required) → show "check your email" message and navigate to `/sign-in`.

### Verify
- With Supabase email confirmation **off**: register → lands on `/dashboard` with welcome toast, no redirect loop.
- With Supabase email confirmation **on**: register → "check your email" message → `/sign-in`.

---

## ✅ Feature — Platform-wide AI verification (any task type)
**Pushed:** commit `3c030f8`
**Date:** 2026-07-17

### Built
Extended Gemini Vision verification from social tasks only to any task type. The per-task `ai_verify_screenshot` toggle on Standard and YouTube tasks now works identically to how it works on social tasks.

- `src/lib/ai-vision.ts` — refactored into a single `verifyScreenshot()` dispatcher: social tasks use `buildSocialPrompt()` (platform/action/handle/required-comment criteria); all other tasks use `buildGenericPrompt()` (task title/description/proof instructions as criteria). Same confidence thresholds and `verifyWithPrompt()` core apply to both paths.
- `src/app/api/tasks/[id]/complete/route.ts` — AI branch condition changed from `task.social_platform && task.ai_verify_screenshot` to `task.ai_verify_screenshot` alone, so any task type triggers Gemini verification.
- `src/app/admin/tasks/page.tsx` — Standard "Verified" tasks now expose a **Proof & Verification** panel: `requires_proof` toggle → `proof_instructions` field → AI auto-verify toggle (only shown when `requires_proof` is on).
- `src/components/tasks/TaskCard.tsx` — standard tasks with `ai_verify_screenshot` show the indigo "AI-verified screenshot required" hint instead of the amber generic proof warning.
- `src/components/tasks/TaskCompletionModal.tsx` — third modal variant for standard AI-verified tasks: screenshot-primary upload zone, AI review notice, inline rejection reason + retry button. Submit button disabled until a screenshot is selected for any AI task.

### Verify
- Create a Standard → Verified task with `ai_verify_screenshot` on → submit with a valid screenshot → Gemini checks against the task title/description/instructions and auto-approves or rejects.
- Social tasks continue to use the platform-specific prompt and behave as before.

---

## ✅ Feature — Global AI verification switch in Admin Settings
**Pushed:** commit `c5c9c14`
**Date:** 2026-07-17

### Built
A single platform-wide toggle in Admin → Settings that forces AI screenshot verification on every task submission, regardless of the per-task `ai_verify_screenshot` flag.

- `supabase/migrations/20260717_ai_global_switch.sql` — seeds `ai_verify_all_tasks = false` in `platform_settings`.
- `src/app/api/admin/settings/route.ts` — `ai_verify_all_tasks: z.boolean().optional()` added to Zod schema; `TASK_SETTINGS_KEYS` set added; calls `revalidateTag("task-settings")` when the key is written.
- `src/app/api/tasks/[id]/complete/route.ts` — reads `ai_verify_all_tasks` from `platform_settings` at request time. If global switch is on and no `proof_url` supplied, returns 400 before any task logic. AI block fires on `(task.ai_verify_screenshot || globalAiEnabled) && proof_url` — either flag is sufficient.
- `src/app/admin/settings/page.tsx` — new **"AI Screenshot Verification"** card at the top of the settings page: indigo-bordered when active, includes a warning reminding admin to confirm `GEMINI_API_KEY` is set in Vercel.

### Verify
- Run `supabase/migrations/20260717_ai_global_switch.sql` — `ai_verify_all_tasks` row present in `platform_settings`.
- Toggle on in Admin Settings → every task submission now requires a screenshot processed by Gemini, regardless of task type or per-task flag.
- Toggle off → per-task `ai_verify_screenshot` flags apply as normal.
- Per-task flags continue to work independently alongside the global switch — either being on is sufficient.

---

## ✅ Remove — Ayet Studios integration deleted
**Pushed:** commit `840aed1`
**Date:** 2026-07-17

### Why
Ayet Studios rejected the application. All associated code was removed to keep the codebase clean.

### Removed
- `src/lib/ayet.ts` — entire file deleted
- `src/app/api/postback/ayet/route.ts` — postback handler deleted
- `src/app/dashboard/tasks/offers/page.tsx` + `loading.tsx` — offer wall pages deleted
- `src/lib/ad-providers.ts` — `"ayet"` removed from `AdProvider` union; `validateAyetSignature()` removed; ayet removed from `getAdProviderSettings()`, `getAdTaskStatusForUser()`, `providerLabel`
- `src/app/api/admin/settings/route.ts` — all `ayet_*` fields removed from Zod schema
- `src/app/admin/settings/page.tsx` — entire Ayet card removed; unused `Layers` import cleaned up; stale Ayet reference removed from ads.txt note
- `src/app/api/postback/adgate/route.ts` — stale Ayet comment removed

### Verify
- `grep -r "ayet" src/` returns zero results.
- Admin Settings page loads without the Ayet card.
- `npx tsc --noEmit` passes clean.

---

## ✅ Monetag site verification
**Pushed:** commit `5bab842`
**Date:** 2026-07-17

### Built
- `public/sw_1784242634655.js` — Monetag publisher verification service worker. Must remain at this path permanently; Monetag's Multitag requires the file to verify and continue serving ads.

### Next step (manual)
- Hit **Verify** on [publishers.monetag.com](https://publishers.monetag.com) after Vercel deploys.
- Do **not** delete or rename the file — removing it breaks Multitag.

---

## ✅ Feature — Games & Earn (Phase 1: free play, no ad gate)
**Pushed:** commit `40b5b49`
**Date:** 2026-07-17

### Overview
Six skill-based mini-games added under `/dashboard/games`. Phase 1 is completely free — sessions are recorded, weekly leaderboard tracks best scores, no entry fees or ad gates yet.

### DB
- `supabase/migrations/20260724_games.sql`:
  - `game_sessions` table — `(user_id, game_slug, score, completed, duration_seconds, metadata, played_at)`; indexes on `(user_id, game_slug)`, `played_at DESC`, `(game_slug, score DESC)`; RLS: users insert/select own rows only
  - `weekly_leaderboard` view — best completed score per user per game since Monday 00:00 UTC; joined to `users` for display name + avatar

> **Action required:** Run `supabase/migrations/20260724_games.sql` in the Supabase SQL Editor before testing.

### Shared library
- `src/lib/games.ts` — word list (540+ 5-letter Wordle words), 6-letter Word Scramble pool, `hashString()` deterministic seeder, `getDailyWord()`, `getDailyNumber()`, `seededShuffle()`, `scrambleWord()`

### API routes
| Route | Method | Purpose |
|---|---|---|
| `/api/games/seed` | GET `?game=wordle\|higher-or-lower` | Returns daily word or secret number (date-seeded) |
| `/api/games/session` | POST | Records a completed session; blocks daily-game repeats with `409 ALREADY_PLAYED` |
| `/api/games/leaderboard` | GET `?game=&limit=` | Weekly top-N; names masked to `J***` for ranks 4+ unless it's the requesting user |
| `/api/games/my-stats` | GET | Per-game: `best_score`, `total_plays`, `completed_today` |

### Pages
| Route | Description |
|---|---|
| `/dashboard/games` | Hub — daily vs arcade sections, best score per game, lock icon after daily plays |
| `/dashboard/games/leaderboard` | Weekly leaderboard with game selector dropdown, gold/silver/bronze rank icons |
| `/dashboard/games/wordle` | Daily 5-letter Wordle — 6 tries, colour-coded tiles, on-screen keyboard; scoring 100–600 pts by guess count |
| `/dashboard/games/higher-or-lower` | Daily number 1–100 — 7 guesses, higher/lower arrows; scoring 10–350 pts by guess count |
| `/dashboard/games/tap-target` | 30 s arcade — targets shrink as time progresses; unlimited replays; score = hits |
| `/dashboard/games/2048` | Full 2048 — arrow keys + swipe-to-move on mobile; unlimited replays |
| `/dashboard/games/color-rush` | Stroop colour test — 30 s, 6 colours, word label uses misdirection colour; unlimited replays |
| `/dashboard/games/word-scramble` | 10 rounds × 15 s — speed bonus (100 base + 10 pts/second remaining); recap table after each game |

### Sidebar
- `src/components/layout/DashboardSidebar.tsx` — **"Games & Earn"** nav item added with `Gamepad2` icon, positioned between "My Tasks" and "Earnings"

### Scoring summary
| Game | Points |
|---|---|
| Wordle | 100 (6 guesses) → 600 (1 guess) |
| Higher or Lower | 10 (7 guesses) → 350 (1 guess) |
| Tap the Target | 1 pt / target hit |
| 2048 | Raw tile-merge score |
| Color Rush | 1 pt / correct answer |
| Word Scramble | 100 base + up to 150 speed bonus per correct word |

### Phases not yet built
- **Phase 2** — Weekly entry fee (paid from kobo balance), prize pool = 80% of fees, 20% platform cut, admin settlement + `leaderboard_payouts` table
- **Phase 3** — IMA SDK rewarded-video ad gate per game session (pending Monetag/Propeller Ads approval)

### Verify
- Run the migration in Supabase SQL Editor.
- Navigate to `/dashboard/games` — hub loads with 6 game cards.
- Play Wordle → session saved → hub shows "Come back tomorrow" lock.
- Play Tap the Target twice → second play allowed (arcade game); leaderboard shows best score.
- `/dashboard/games/leaderboard` — switch game dropdown → leaderboard reloads.
- `npx tsc --noEmit` passes clean.
