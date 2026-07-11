-- ============================================================
-- BountyTask — Initial Schema
-- Append-only ledger. Balance is ALWAYS calculated from ledger.
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ─── Users (extends auth.users) ──────────────────────────────
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  username      text unique,
  avatar_url    text,
  phone         text,
  role          text not null default 'user' check (role in ('user','admin','super_admin')),
  referral_code text not null unique default upper(substring(gen_random_uuid()::text, 1, 8)),
  referred_by   uuid references public.users(id) on delete set null,
  is_active     boolean not null default true,
  is_email_verified boolean not null default false,
  kyc_verified  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_users_referral_code on public.users(referral_code);
create index idx_users_email on public.users(email);
create index idx_users_role on public.users(role);

-- ─── Task Categories ─────────────────────────────────────────
create table public.task_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  icon        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── Tasks ───────────────────────────────────────────────────
create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text not null,
  instructions        text not null,
  category_id         uuid references public.task_categories(id) on delete set null,
  type                text not null default 'unverified' check (type in ('verified','unverified')),
  status              text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  reward_amount       bigint not null check (reward_amount > 0), -- kobo
  max_completions     integer,                                    -- null = unlimited
  current_completions integer not null default 0,
  requires_proof      boolean not null default false,
  proof_instructions  text,
  time_limit_hours    integer,
  verification_url    text,
  created_by          uuid references public.users(id) on delete set null,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_tasks_status on public.tasks(status);
create index idx_tasks_category on public.tasks(category_id);
create index idx_tasks_type on public.tasks(type);

-- ─── Task Completions ─────────────────────────────────────────
create table public.task_completions (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references public.tasks(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending','approved','rejected','flagged')),
  proof_url        text,
  proof_text       text,
  submitted_at     timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.users(id) on delete set null,
  rejection_reason text,
  created_at       timestamptz not null default now(),
  unique (task_id, user_id)  -- one completion per user per task
);

create index idx_completions_task on public.task_completions(task_id);
create index idx_completions_user on public.task_completions(user_id);
create index idx_completions_status on public.task_completions(status);

-- ─── Referrals ────────────────────────────────────────────────
create table public.referrals (
  id             uuid primary key default gen_random_uuid(),
  referrer_id    uuid not null references public.users(id) on delete cascade,
  referred_id    uuid not null references public.users(id) on delete cascade,
  bonus_credited boolean not null default false,
  bonus_amount   bigint not null default 0,
  credited_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (referred_id)  -- each user can only be referred once
);

create index idx_referrals_referrer on public.referrals(referrer_id);

-- ─── Ledger (APPEND-ONLY, IMMUTABLE) ─────────────────────────
-- DO NOT UPDATE OR DELETE ROWS IN THIS TABLE.
-- Balance is always: SELECT COALESCE(SUM(delta),0) FROM ledger WHERE user_id = $1
create table public.ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       text not null check (type in ('credit','debit')),
  delta      bigint not null, -- kobo. Positive=credit, Negative=debit
  ref_type   text not null check (ref_type in (
    'task_reward','referral_bonus','signup_bonus',
    'withdrawal_debit','withdrawal_reversal','admin_adjustment','penalty'
  )),
  ref_id     uuid,            -- FK to related record (optional)
  note       text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index idx_ledger_user on public.ledger(user_id);
create index idx_ledger_ref on public.ledger(ref_id);
create index idx_ledger_type on public.ledger(ref_type);

-- ─── Withdrawal Accounts ──────────────────────────────────────
create table public.withdrawal_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  bank_code      text not null,
  bank_name      text not null,
  account_number text not null,
  account_name   text not null,
  is_verified    boolean not null default false,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);

create index idx_withdrawal_accounts_user on public.withdrawal_accounts(user_id);

-- ─── Withdrawals ──────────────────────────────────────────────
create table public.withdrawals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  account_id      uuid not null references public.withdrawal_accounts(id) on delete restrict,
  amount          bigint not null check (amount > 0), -- kobo
  status          text not null default 'pending' check (status in (
    'pending','under_review','approved','rejected','paid'
  )),
  requested_at    timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid references public.users(id) on delete set null,
  paid_at         timestamptz,
  rejection_reason text,
  admin_notes     text,
  ledger_entry_id uuid references public.ledger(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index idx_withdrawals_user on public.withdrawals(user_id);
create index idx_withdrawals_status on public.withdrawals(status);

-- ─── Fraud Flags ──────────────────────────────────────────────
create table public.fraud_flags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  reason      text not null,
  severity    text not null check (severity in ('low','medium','high','critical')),
  details     jsonb,
  resolved    boolean not null default false,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_fraud_user on public.fraud_flags(user_id);
create index idx_fraud_severity on public.fraud_flags(severity);
create index idx_fraud_resolved on public.fraud_flags(resolved);

-- ─── Devices ──────────────────────────────────────────────────
create table public.devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  fingerprint  text not null,
  ip_address   text,
  user_agent   text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create index idx_devices_fingerprint on public.devices(fingerprint);

-- ─── Notifications ────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  message    text not null,
  ref_id     uuid,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id);
create index idx_notifications_read on public.notifications(user_id, read);

-- ─── Admin Notes ──────────────────────────────────────────────
create table public.admin_notes (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('user','task','withdrawal','completion')),
  target_id   uuid not null,
  note        text not null,
  created_by  uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ─── Audit Logs (IMMUTABLE) ───────────────────────────────────
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.users(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  details     jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index idx_audit_actor on public.audit_logs(actor_id);
create index idx_audit_action on public.audit_logs(action);
create index idx_audit_target on public.audit_logs(target_type, target_id);
