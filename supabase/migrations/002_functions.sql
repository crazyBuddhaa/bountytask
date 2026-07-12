-- ============================================================
-- BountyTask — Functions & Triggers
-- ============================================================

-- ─── Live Balance Function ────────────────────────────────────
-- The ONLY correct way to get a user's balance.
-- Balance is never stored — always computed.
create or replace function get_user_balance(p_user_id uuid)
returns bigint
language sql
stable
security definer
as $$
  select coalesce(sum(delta), 0)::bigint
  from public.ledger
  where user_id = p_user_id;
$$;

-- ─── Auto-update updated_at ───────────────────────────────────
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function update_updated_at();

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function update_updated_at();

-- ─── Increment task completion counter ───────────────────────
create or replace function increment_task_completions()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'approved' and (old.status is null or old.status <> 'approved') then
    update public.tasks
    set current_completions = current_completions + 1
    where id = new.task_id;

    -- Auto-close task if max_completions reached
    update public.tasks
    set status = 'completed'
    where id = new.task_id
      and max_completions is not null
      and current_completions >= max_completions;
  end if;
  return new;
end;
$$;

create trigger on_completion_approved
  after insert or update on public.task_completions
  for each row execute function increment_task_completions();

-- ─── Prevent ledger mutations ─────────────────────────────────
create or replace function prevent_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Ledger entries are immutable. INSERT only.';
end;
$$;

create trigger ledger_no_update
  before update on public.ledger
  for each row execute function prevent_ledger_mutation();

create trigger ledger_no_delete
  before delete on public.ledger
  for each row execute function prevent_ledger_mutation();

-- ─── Prevent audit log mutations ──────────────────────────────
create trigger audit_no_update
  before update on public.audit_logs
  for each row execute function prevent_ledger_mutation();

create trigger audit_no_delete
  before delete on public.audit_logs
  for each row execute function prevent_ledger_mutation();

-- ─── Handle new user registration ────────────────────────────
-- Called via auth trigger or webhook to create the public.users row
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Admin dashboard stats function ──────────────────────────
-- Field names/units here must match the `Stats` interface consumed by
-- src/app/admin/page.tsx (all money fields in kobo, suffixed `_kobo`).
create or replace function get_platform_stats()
returns json
language sql
stable
security definer
as $
  select json_build_object(
    'total_users',              (select count(*) from public.users where role = 'user'),
    'active_users',             (select count(*) from public.users where role = 'user' and is_active = true),
    'total_tasks',              (select count(*) from public.tasks),
    'active_tasks',             (select count(*) from public.tasks where status = 'active'),
    'total_completions',        (select count(*) from public.task_completions),
    'pending_completions',      (select count(*) from public.task_completions where status = 'pending'),
    'total_withdrawn_kobo',     (select coalesce(sum(amount), 0) from public.withdrawals where status = 'paid'),
    'pending_withdrawals_kobo', (select coalesce(sum(amount), 0) from public.withdrawals where status in ('pending','under_review')),
    'total_fraud_flags',        (select count(*) from public.fraud_flags where resolved = false),
    'total_ledger_credits_kobo',(select coalesce(sum(delta), 0) from public.ledger where type = 'credit')
  );
$;
