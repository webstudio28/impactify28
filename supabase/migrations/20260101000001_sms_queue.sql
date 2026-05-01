-- Outbound SMS queue for scheduled campaigns and inter-step delays.
-- Process with /api/cron/process-sms (CRON_SECRET + optional service role).

create table public.outbound_sms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  step_order int not null default 1,
  to_phone text not null,
  body text not null,
  run_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_outbound_sms_pending on public.outbound_sms (status, run_at);
create index idx_outbound_sms_user on public.outbound_sms (user_id);

alter table public.outbound_sms enable row level security;

create policy "Users read own outbound"
  on public.outbound_sms for select using (auth.uid() = user_id);

create policy "Users insert own outbound"
  on public.outbound_sms for insert with check (auth.uid() = user_id);

create policy "Users update own outbound"
  on public.outbound_sms for update using (auth.uid() = user_id);
