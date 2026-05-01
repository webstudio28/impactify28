-- Impact28: multi-tenant schema (one auth user = one business)
-- Run in Supabase SQL editor or via CLI after linking project

create extension if not exists "pgcrypto";

-- Profile per auth user
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  audience_type text not null check (audience_type in ('phone', 'email')),
  created_at timestamptz not null default now()
);

create table public.audience_members (
  id uuid primary key default gen_random_uuid(),
  audience_id uuid not null references public.audiences (id) on delete cascade,
  value text not null,
  created_at timestamptz not null default now(),
  unique (audience_id, value)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'queued', 'sending', 'completed', 'failed', 'cancelled')),
  audience_id uuid references public.audiences (id) on delete set null,
  send_immediately boolean not null default false,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  step_order int not null,
  body text not null,
  link_url text,
  delay_after_previous_hours int not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create index idx_audiences_user on public.audiences (user_id);
create index idx_audience_members_audience on public.audience_members (audience_id);
create index idx_campaigns_user on public.campaigns (user_id);
create index idx_campaigns_status_scheduled on public.campaigns (status, scheduled_at);
create index idx_campaign_steps_campaign on public.campaign_steps (campaign_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, business_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', 'My business')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.audiences enable row level security;
alter table public.audience_members enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_steps enable row level security;

create policy "Users read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users manage own audiences"
  on public.audiences for all using (auth.uid() = user_id);

create policy "Users manage audience members via audience"
  on public.audience_members for all
  using (
    exists (
      select 1 from public.audiences a
      where a.id = audience_members.audience_id and a.user_id = auth.uid()
    )
  );

create policy "Users manage own campaigns"
  on public.campaigns for all using (auth.uid() = user_id);

create policy "Users manage campaign steps via campaign"
  on public.campaign_steps for all
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_steps.campaign_id and c.user_id = auth.uid()
    )
  );
