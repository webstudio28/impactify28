-- Campaign sales attribution (tracker.js + per-campaign cmp links)

create table if not exists public.campaign_sales_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id text not null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  recipient_token text,
  order_value numeric(14, 2) not null check (order_value > 0),
  currency text not null default 'BGN',
  event_time timestamptz not null default now(),
  source text not null default 'snippet',
  created_at timestamptz not null default now(),
  unique (user_id, order_id)
);

create index if not exists idx_campaign_sales_events_campaign
  on public.campaign_sales_events (campaign_id, event_time desc);

create index if not exists idx_campaign_sales_events_user_time
  on public.campaign_sales_events (user_id, event_time desc);

create table if not exists public.campaign_sales_rollups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  conversion_count int not null default 0,
  revenue_total numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaign_sales_rollups_campaign_window
  on public.campaign_sales_rollups (campaign_id, window_end desc);

alter table public.campaign_sales_events enable row level security;
alter table public.campaign_sales_rollups enable row level security;

grant select on public.campaign_sales_events to authenticated;
grant select on public.campaign_sales_rollups to authenticated;

drop policy if exists "Users read own sales events" on public.campaign_sales_events;
create policy "Users read own sales events"
  on public.campaign_sales_events
  for select
  using (user_id = auth.uid());

drop policy if exists "Users read own campaign sales rollups" on public.campaign_sales_rollups;
create policy "Users read own campaign sales rollups"
  on public.campaign_sales_rollups
  for select
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_sales_rollups.campaign_id
        and c.user_id = auth.uid()
    )
  );
