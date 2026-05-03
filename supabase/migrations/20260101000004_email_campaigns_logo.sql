-- Email campaigns, profile logos, outbound email queue, storage bucket.

alter table public.profiles
  add column if not exists logo_url text;

alter table public.campaigns
  add column if not exists channel text not null default 'sms'
    check (channel in ('sms', 'email')),
  add column if not exists email_subject text,
  add column if not exists email_html text,
  add column if not exists email_include_all boolean not null default true,
  add column if not exists email_selected_member_ids uuid[] not null default '{}',
  add column if not exists email_generation_input jsonb;

create table public.outbound_email (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  to_email text not null,
  subject text not null,
  html_body text not null,
  run_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_outbound_email_pending on public.outbound_email (status, run_at);
create index idx_outbound_email_user on public.outbound_email (user_id);
create index idx_outbound_email_campaign on public.outbound_email (campaign_id);

alter table public.outbound_email enable row level security;

create policy "Users read own outbound email"
  on public.outbound_email for select using (auth.uid() = user_id);

create policy "Users insert own outbound email"
  on public.outbound_email for insert with check (auth.uid() = user_id);

create policy "Users update own outbound email"
  on public.outbound_email for update using (auth.uid() = user_id);

-- Public bucket: logo URLs are embedded in HTML; restrict writes to own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-logos',
  'profile-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Logo objects read" on storage.objects;
create policy "Logo objects read"
  on storage.objects for select
  using (bucket_id = 'profile-logos');

drop policy if exists "Logo upload own folder" on storage.objects;
create policy "Logo upload own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Logo update own folder" on storage.objects;
create policy "Logo update own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Logo delete own folder" on storage.objects;
create policy "Logo delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
