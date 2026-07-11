# BountyTask — Build Stages

## ✅ Stage 0 — Foundation (DONE)
Everything already written in this session:
- `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js`
- `.env.example` — all required env vars documented
- `src/types/index.ts` — all domain types (UserProfile, Task, Ledger, Withdrawal, etc.)
- `src/lib/supabase/{client,server,admin}.ts` — Supabase clients
- `src/lib/{ledger,paystack,notifications,fraud,audit,referrals,utils}.ts` — core business logic
- `supabase/migrations/001_initial_schema.sql` — all 13 tables
- `supabase/migrations/002_functions.sql` — balance function, triggers, immutability
- `supabase/migrations/003_rls.sql` — Row Level Security for every table
- `supabase/migrations/004_seed.sql` — 10 task categories
- `src/middleware.ts` — auth guard, admin guard, redirect logic
- `src/app/globals.css` — Tailwind theme + brand gradient
- `src/app/layout.tsx` — root layout with font + Sonner toaster
- `src/app/api/auth/callback/route.ts` — OAuth callback, signup bonus, referral link

---

## Stage 1 — Auth & User Onboarding
**Goal:** Users can register, sign in, and land on a working dashboard.

Files to build:
- `src/components/ui/` — button, input, card, badge, avatar, skeleton, etc.
- `src/app/(auth)/sign-in/page.tsx` — email/password + Google OAuth
- `src/app/(auth)/register/page.tsx` — full name, email, password, optional referral code
- `src/app/(auth)/layout.tsx` — centered auth layout
- `src/app/api/profile/route.ts` — GET profile + balance, PATCH profile
- `src/app/dashboard/layout.tsx` — sidebar + header shell
- `src/app/dashboard/page.tsx` — overview: balance, recent tasks, quick stats

**Verify:** Register → auto-credited ₦200 signup bonus → dashboard shows balance.

---

## Stage 2 — Task Marketplace
**Goal:** Users can browse and complete tasks and earn credits.

Files to build:
- `src/app/api/tasks/route.ts` — GET list (paginated, filtered), POST create (admin)
- `src/app/api/tasks/[id]/route.ts` — GET single, PATCH, DELETE
- `src/app/api/tasks/[id]/complete/route.ts` — submit completion
- `src/app/dashboard/tasks/page.tsx` — task marketplace with search/filter
- `src/app/dashboard/my-tasks/page.tsx` — user's submitted completions + status
- `src/components/tasks/TaskCard.tsx` — task listing card
- `src/components/tasks/TaskCompletionModal.tsx` — submit proof modal

**Verify:** Complete an unverified task → immediate ₦ credit → balance updates.

---

## Stage 3 — Ledger & Earnings
**Goal:** Users can see their full transaction history and live balance.

Files to build:
- `src/app/api/ledger/route.ts` — paginated ledger + live balance
- `src/app/dashboard/earnings/page.tsx` — balance widget + full ledger table
- `src/components/ledger/LedgerTable.tsx` — paginated entry list with ref type badges

**Verify:** Every credit/debit is visible. Balance matches SUM(delta) from DB.

---

## Stage 4 — Withdrawals
**Goal:** Users can add a verified bank account and request withdrawals.

Files to build:
- `src/app/api/paystack/banks/route.ts` — bank list from Paystack
- `src/app/api/paystack/resolve/route.ts` — verify account number
- `src/app/api/withdrawals/accounts/route.ts` — CRUD withdrawal accounts
- `src/app/api/withdrawals/accounts/[id]/route.ts` — delete/set-default
- `src/app/api/withdrawals/route.ts` — GET list, POST request withdrawal
- `src/app/dashboard/withdrawal/page.tsx` — add account + request withdrawal form
- `src/components/withdrawals/BankAccountCard.tsx`
- `src/components/withdrawals/WithdrawalForm.tsx`

**Verify:** Add bank → Paystack verifies account name → request withdrawal → ledger debit created → status = pending.

---

## Stage 5 — Referral Program
**Goal:** Users can invite others and earn bonuses.

Files to build:
- `src/app/api/referrals/route.ts` — GET referral stats + list
- `src/app/dashboard/referral/page.tsx` — referral code, share links, stats, history
- `src/components/referral/ReferralCard.tsx`

**Verify:** User A refers User B → User B completes first task → User A gets ₦500 bonus.

---

## Stage 6 — Notifications
**Goal:** Users are notified of task approvals, rejections, withdrawals, bonuses.

Files to build:
- `src/app/api/notifications/route.ts` — GET paginated, PATCH mark-read
- `src/app/dashboard/notifications/page.tsx` — notification inbox
- `src/components/layout/NotificationBell.tsx` — header badge with unread count

**Verify:** Task approved → in-app notification appears → badge shows unread count.

---

## Stage 7 — Profile & Security
**Goal:** Users can manage their profile and account security.

Files to build:
- `src/app/dashboard/profile/page.tsx` — edit name, username, phone, avatar
- `src/app/dashboard/security/page.tsx` — change password, list active sessions, device history

---

## Stage 8 — Admin Dashboard
**Goal:** Admins can manage users, approve tasks, process withdrawals.

Files to build:
- `src/app/admin/layout.tsx` — admin sidebar shell
- `src/app/admin/page.tsx` — platform stats overview (users, tasks, pending items)
- `src/app/api/admin/stats/route.ts`
- `src/app/admin/users/page.tsx` — user table with search + role badges
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/admin/tasks/page.tsx` — task CRUD
- `src/app/api/admin/tasks/route.ts`
- `src/app/api/admin/tasks/[id]/route.ts`
- `src/app/admin/approvals/page.tsx` — pending completions queue
- `src/app/api/admin/approvals/route.ts`
- `src/app/admin/withdrawals/page.tsx` — withdrawal review
- `src/app/api/admin/withdrawals/route.ts`

**Verify:** Admin approves completion → user gets credit → admin rejects withdrawal → ledger reversal entry created.

---

## Stage 9 — Fraud Detection & Audit
**Goal:** Admins can detect and resolve fraud; all actions are audited.

Files to build:
- `src/app/admin/fraud/page.tsx` — fraud flags table with severity + resolve
- `src/app/api/admin/fraud/route.ts`
- `src/app/admin/audit-logs/page.tsx` — searchable audit log
- `src/app/api/admin/audit-logs/route.ts`

---

## Stage 10 — Ledger Explorer & Reports (Admin)
**Goal:** Admins can inspect every ledger entry and view analytics.

Files to build:
- `src/app/admin/ledger/page.tsx` — full ledger explorer with user/type filters
- `src/app/api/admin/ledger/route.ts`
- `src/app/admin/reports/page.tsx` — charts: signups, completions, credits, withdrawals
- `src/app/api/admin/reports/route.ts`

---

## Stage 11 — Public Pages
**Goal:** Public-facing landing page, about, FAQ, contact.

Files to build:
- `src/app/page.tsx` — landing page (hero, how it works, stats, CTA)
- `src/app/about/page.tsx`
- `src/app/faq/page.tsx`
- `src/app/contact/page.tsx`
- `src/components/layout/PublicHeader.tsx`
- `src/components/layout/Footer.tsx`

---

## Stage 12 — Cron Jobs & GitHub Actions
**Goal:** Automated task expiry runs on schedule.

Files to build:
- `src/app/api/cron/process-tasks/route.ts` — close expired tasks, secured by CRON_SECRET
- `.github/workflows/cron.yml` — GitHub Actions cron every hour

---

## Stage 13 — Production Hardening
- Environment variable validation on startup
- Rate limiting (task completions: 10/hour per user)
- Error boundary pages (error.tsx, not-found.tsx)
- Loading skeletons for all async pages
- `src/app/error.tsx`, `src/app/not-found.tsx`
- Full README with setup instructions

---

## Deployment Checklist
1. Create Supabase project → run migrations 001–004 in order
2. Set all env vars in Vercel (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY, RESEND_API_KEY, CRON_SECRET)
3. Set NEXT_PUBLIC_APP_URL to your Vercel domain
4. In Supabase Auth → Site URL → set to Vercel domain
5. Add `/api/auth/callback` to Supabase Auth → Redirect URLs
6. Enable Google OAuth in Supabase (optional)
7. Add CRON_SECRET to GitHub Actions secrets for the cron workflow
8. Deploy to Vercel via `vercel --prod`
