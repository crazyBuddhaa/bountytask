-- ============================================================
-- BountyTask — Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.task_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.referrals enable row level security;
alter table public.ledger enable row level security;
alter table public.withdrawal_accounts enable row level security;
alter table public.withdrawals enable row level security;
alter table public.fraud_flags enable row level security;
alter table public.devices enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_notes enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: is current user an admin?
create or replace function is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  );
$$;

-- ─── users ───────────────────────────────────────────────────
create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Admins can read all users"
  on public.users for select
  using (is_admin());

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (
    -- cannot elevate own role
    role = (select role from public.users where id = auth.uid())
  );

create policy "Admins can update users"
  on public.users for update
  using (is_admin());

-- ─── task_categories ─────────────────────────────────────────
create policy "Anyone can read active categories"
  on public.task_categories for select
  using (is_active = true or is_admin());

create policy "Admins manage categories"
  on public.task_categories for all
  using (is_admin());

-- ─── tasks ───────────────────────────────────────────────────
create policy "Anyone can read active tasks"
  on public.tasks for select
  using (status = 'active' or is_admin());

create policy "Admins manage tasks"
  on public.tasks for all
  using (is_admin());

-- ─── task_completions ────────────────────────────────────────
create policy "Users see own completions"
  on public.task_completions for select
  using (auth.uid() = user_id);

create policy "Admins see all completions"
  on public.task_completions for select
  using (is_admin());

create policy "Authenticated users can insert completions"
  on public.task_completions for insert
  with check (auth.uid() = user_id);

create policy "Admins can update completions"
  on public.task_completions for update
  using (is_admin());

-- ─── referrals ───────────────────────────────────────────────
create policy "Users see own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id);

create policy "Admins see all referrals"
  on public.referrals for select
  using (is_admin());

-- ─── ledger ──────────────────────────────────────────────────
-- NO client-side inserts. All ledger writes go through service role (admin client).
create policy "Users can read own ledger"
  on public.ledger for select
  using (auth.uid() = user_id);

create policy "Admins can read all ledger"
  on public.ledger for select
  using (is_admin());

-- Deny all mutations from clients (enforced by triggers too)
create policy "No client ledger inserts"
  on public.ledger for insert
  with check (false);

-- ─── withdrawal_accounts ─────────────────────────────────────
create policy "Users manage own accounts"
  on public.withdrawal_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins see all accounts"
  on public.withdrawal_accounts for select
  using (is_admin());

-- ─── withdrawals ─────────────────────────────────────────────
create policy "Users see own withdrawals"
  on public.withdrawals for select
  using (auth.uid() = user_id);

create policy "Admins see all withdrawals"
  on public.withdrawals for select
  using (is_admin());

create policy "Authenticated users can request withdrawals"
  on public.withdrawals for insert
  with check (auth.uid() = user_id);

create policy "Admins update withdrawals"
  on public.withdrawals for update
  using (is_admin());

-- ─── fraud_flags ─────────────────────────────────────────────
create policy "Admins manage fraud flags"
  on public.fraud_flags for all
  using (is_admin());

-- ─── devices ─────────────────────────────────────────────────
create policy "Users see own devices"
  on public.devices for select
  using (auth.uid() = user_id);

create policy "Admins see all devices"
  on public.devices for select
  using (is_admin());

-- ─── notifications ───────────────────────────────────────────
create policy "Users manage own notifications"
  on public.notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins see all notifications"
  on public.notifications for select
  using (is_admin());

-- ─── admin_notes ─────────────────────────────────────────────
create policy "Admins manage notes"
  on public.admin_notes for all
  using (is_admin());

-- ─── audit_logs ──────────────────────────────────────────────
create policy "Admins read audit logs"
  on public.audit_logs for select
  using (is_admin());
