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

### Planned
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
**Pushed:** commit `(pending)`
**Date:** 2026-07-11

### Built
- `src/app/api/notifications/route.ts` — paginated list ordered by unread-first; PATCH mark-read (single IDs or all)
- `src/app/dashboard/notifications/page.tsx` — inbox with unread dot, type emoji icons, click-to-read, mark-all-read button, pagination

### Verify
- Task approved → in-app notification appears at top of inbox.
- Click a notification → dot disappears (marked read).
- Mark all → all dots clear, header count drops to zero.

---

## ⏳ Stage 7 — Profile & Security
**Status:** Pending

### Planned
- `src/app/dashboard/profile/page.tsx` — edit name, username, phone, avatar upload
- `src/app/dashboard/security/page.tsx` — change password, active session info

---

## ⏳ Stage 8 — Admin Dashboard
**Status:** Pending

### Planned
- `src/components/admin/AdminSidebar.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx` — platform stats
- `src/app/admin/users/page.tsx` — user table with search, role, balance
- `src/app/admin/tasks/page.tsx` — task CRUD with status management
- `src/app/admin/approvals/page.tsx` — pending completions queue, bulk approve/reject
- `src/app/admin/withdrawals/page.tsx` — withdrawal review
- All admin API routes (stats, users, tasks, approvals, withdrawals)

### Verify
- Admin approves completion → user balance increases.
- Admin rejects withdrawal → ledger reversal entry appears.

---

## ⏳ Stage 9 — Fraud Detection & Audit
**Status:** Pending

### Planned
- `src/app/admin/fraud/page.tsx` — open fraud flags, severity filter, resolve
- `src/app/admin/audit-logs/page.tsx` — searchable immutable log
- Admin API routes: fraud, audit-logs

---

## ⏳ Stage 10 — Ledger Explorer & Reports (Admin)
**Status:** Pending

### Planned
- `src/app/admin/ledger/page.tsx` — full ledger with user/type/date filters
- `src/app/admin/reports/page.tsx` — charts: signups, completions, credits, withdrawals
- Admin API routes: ledger, reports

---

## ⏳ Stage 11 — Public Pages
**Status:** Pending

### Planned
- `src/app/page.tsx` — landing page
- `src/app/about/page.tsx`, `src/app/faq/page.tsx`, `src/app/contact/page.tsx`
- `src/components/layout/PublicHeader.tsx`, `src/components/layout/Footer.tsx`

---

## ⏳ Stage 12 — Cron Jobs
**Status:** Pending

### Planned
- `src/app/api/cron/process-tasks/route.ts` — close expired tasks (secured by CRON_SECRET)
- `.github/workflows/cron.yml` — GitHub Actions hourly schedule

---

## ⏳ Stage 13 — Production Hardening
**Status:** Pending

### Planned
- `src/app/error.tsx`, `src/app/not-found.tsx`
- `vercel.json` — cron config, headers, redirects
- `README.md` — full setup and deployment guide
