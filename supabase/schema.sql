create extension if not exists pgcrypto;

create table if not exists public.qc_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  division text not null,
  batch_name text not null,
  quantity text not null,
  unit text not null,
  reporter text not null,
  note text default '',
  photos jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  status text not null default 'Menunggu QC' check (status in ('Menunggu QC', 'Revisi', 'ACC QC')),
  qc_note text default '',
  signature text default '',
  reviewed_at timestamptz,
  resubmitted_at timestamptz
);

create index if not exists qc_reports_user_created_idx on public.qc_reports (user_id, created_at desc);
create index if not exists qc_reports_user_status_idx on public.qc_reports (user_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_qc_reports_updated_at on public.qc_reports;
create trigger set_qc_reports_updated_at
before update on public.qc_reports
for each row
execute function public.set_updated_at();

alter table public.qc_reports enable row level security;

drop policy if exists "Users can read their own QC reports" on public.qc_reports;
create policy "Users can read their own QC reports"
on public.qc_reports
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own QC reports" on public.qc_reports;
create policy "Users can create their own QC reports"
on public.qc_reports
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own QC reports" on public.qc_reports;
create policy "Users can update their own QC reports"
on public.qc_reports
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own QC reports" on public.qc_reports;
create policy "Users can delete their own QC reports"
on public.qc_reports
for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('qc-attachments', 'qc-attachments', false, 52428800)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "Users can read their own QC attachments" on storage.objects;
create policy "Users can read their own QC attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'qc-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can upload their own QC attachments" on storage.objects;
create policy "Users can upload their own QC attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'qc-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update their own QC attachments" on storage.objects;
create policy "Users can update their own QC attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'qc-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'qc-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own QC attachments" on storage.objects;
create policy "Users can delete their own QC attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'qc-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
