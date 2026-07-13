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

## ✅ Post-launch — Bank Verification Provider Switch (RapidAPI)
**Date:** 2026-07-13

### Built
- `src/lib/rapidapi.ts` — new provider for bank account number verification: `fetchBanks()` (bundled static list of 86 Nigerian banks/PSBs/MFBs with CBN codes) and `resolveAccount()` (calls the RapidAPI "Nigeria Bank Account validation" endpoint using `RAPIDAPI_KEY` / `RAPIDAPI_HOST`).
- Moved `src/app/api/paystack/{banks,resolve}` → `src/app/api/bank-verification/{banks,resolve}`, now backed by `rapidapi.ts`.
- `src/app/api/withdrawals/accounts/route.ts` — `resolveAccount` import switched from `@/lib/paystack` to `@/lib/rapidapi`.
- `src/app/dashboard/withdrawal/page.tsx` — bank list + account resolution calls updated to the new `/api/bank-verification/*` routes.
- `.env.example` / `README.md` — documented `RAPIDAPI_KEY` / `RAPIDAPI_HOST`; clarified `PAYSTACK_SECRET_KEY` is now only used for the withdrawal verification fee and advertiser payments.
- `src/lib/paystack.ts` left untouched — kept as-is for those two payment flows and as a future fallback/alternate verification provider.

### Verify
- Add a bank account on `/dashboard/withdrawal` → account name resolves via RapidAPI, not Paystack.
- `GET /api/bank-verification/banks` returns the bundled bank list without hitting any external API.
- Withdrawal verification-fee flow (`/api/verification/paystack`) and advertiser payments (`/api/advertiser/paystack`) still work unchanged — they never touched account verification.

---

### Scalability outlook after all fixes
| Users | Status | Notes |
|---|---|---|
| 1k–10k | ✅ Solid | All critical bottlenecks resolved |
| 25k | ✅ Solid | Materialized balance eliminates the former breakpoint |
| 50k | ⚠️ Watch | Switch Supabase connection pool to **transaction mode** (no code changes) |
| 100k+ | Needs work | Read replica for admin routes; evaluate Supabase Pro/Team tier |
