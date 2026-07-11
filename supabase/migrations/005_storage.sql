-- ============================================================
-- BountyTask — Supabase Storage Buckets & Policies
-- ============================================================

-- Avatars bucket (public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  array['image/jpeg','image/png','image/webp','image/gif']
) on conflict (id) do nothing;

-- Task proofs bucket (private — only owner + admin can read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-proofs',
  'task-proofs',
  false,
  10485760, -- 10MB
  array['image/jpeg','image/png','image/webp','application/pdf','video/mp4']
) on conflict (id) do nothing;

-- ─── Avatar policies ─────────────────────────────────────────
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── Task proof policies ──────────────────────────────────────
create policy "Users can upload task proofs"
  on storage.objects for insert
  with check (
    bucket_id = 'task-proofs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own proofs"
  on storage.objects for select
  using (
    bucket_id = 'task-proofs'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.users
        where id = auth.uid() and role in ('admin','super_admin')
      )
    )
  );

create policy "Users can delete own proofs"
  on storage.objects for delete
  using (
    bucket_id = 'task-proofs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
