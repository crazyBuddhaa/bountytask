# BountyTask

A Nigerian micro-task platform where users earn ₦ by completing online tasks. Built with Next.js 15, Supabase, and Paystack.

---

## Features

- **Task Marketplace** — Browse and complete verified/unverified tasks for instant or reviewed rewards
- **Append-only Ledger** — Every credit and debit is a row; balance is always `SUM(delta)` — no balance columns
- **Withdrawals** — Bank account verification via Paystack, admin-reviewed withdrawal queue
- **Referral Program** — Unique referral codes, ₦500 bonus when a referred user completes their first task
- **Admin Dashboard** — User management, task CRUD, approval queue, withdrawal review, analytics charts
- **Fraud Detection** — Device fingerprinting, rate limiting (10 completions/hr), severity-flagged fraud queue
- **Audit Log** — Immutable append-only log of every admin action, enforced by DB trigger

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database & Auth | Supabase (Postgres + Auth + Storage) |
| Payments | Paystack (bank verification, no auto-payouts) |
| Email | Resend |
| UI | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| Deployment | Vercel + GitHub Actions |

---

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run migrations

In the Supabase SQL editor, run each migration **in order**:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_functions.sql
supabase/migrations/003_rls.sql
supabase/migrations/004_seed.sql
supabase/migrations/005_storage.sql
```

### 3. Configure Supabase Auth

- **Site URL** → set to your production domain (e.g. `https://bountytask.vercel.app`)
- **Redirect URLs** → add `https://your-domain.vercel.app/api/auth/callback`
- **Google OAuth** (optional) → enable in Auth → Providers

### 4. Environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `NEXT_PUBLIC_APP_URL` | Full app URL (e.g. `https://bountytask.vercel.app`) |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (for bank verification) |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `ADMIN_EMAIL` | Email address for admin notifications |
| `CRON_SECRET` | Secret string to authenticate cron job requests |

### 5. Run locally

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`.

---

## Deployment (Vercel)

1. Import the repo in [vercel.com](https://vercel.com)
2. Add all environment variables from the table above
3. Deploy — Vercel picks up `vercel.json` automatically

### Cron Jobs (GitHub Actions)

The `.github/workflows/cron.yml` workflow fires every hour to close expired tasks.

Add these secrets to your GitHub repo (`Settings → Secrets → Actions`):

| Secret | Value |
|---|---|
| `APP_URL` | Your production URL (e.g. `https://bountytask.vercel.app`) |
| `CRON_SECRET` | Same value as the `CRON_SECRET` env var in Vercel |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Sign-in, register pages
│   ├── admin/           # Admin dashboard (9 sections)
│   ├── api/             # API routes (REST)
│   ├── dashboard/       # User dashboard (8 pages)
│   └── page.tsx         # Public landing page
├── components/
│   ├── admin/           # Admin-specific components
│   ├── layout/          # Header, sidebar, footer
│   ├── tasks/           # TaskCard, TaskCompletionModal
│   └── ui/              # shadcn/ui primitives
├── lib/
│   ├── supabase/        # browser, server, and admin clients
│   ├── ledger.ts        # appendLedger, getLiveBalance
│   ├── fraud.ts         # flagUser, rate limiting, device checks
│   ├── referrals.ts     # processReferral, bonus crediting
│   ├── notifications.ts # in-app + email notifications
│   ├── paystack.ts      # bank list + account verification
│   ├── audit.ts         # auditLog (append-only)
│   └── storage.ts       # avatar + proof file uploads
├── types/index.ts       # All domain types
└── middleware.ts        # Auth guard, admin guard
supabase/
└── migrations/          # 005 SQL migration files
```

---

## Key Design Decisions

- **Append-only ledger** — No balance column exists anywhere. Balance is always `SELECT SUM(delta) FROM ledger WHERE user_id = $1`, enforced by RLS and a DB trigger that prevents updates/deletes.
- **Amounts in kobo** — All monetary values stored as integers in kobo (1 NGN = 100 kobo) to avoid floating-point errors.
- **Two task types** — `unverified` tasks credit immediately on submission; `verified` tasks require admin approval before credit.
- **Three Supabase clients** — `client.ts` (browser, anon key), `server.ts` (RSC/actions, anon key + cookie session), `admin.ts` (service role, bypasses RLS for trusted server writes).
- **Paystack for verification only** — Bank accounts are verified via Paystack's resolve API, but actual payouts are manual (admin marks `paid` after transferring externally).
