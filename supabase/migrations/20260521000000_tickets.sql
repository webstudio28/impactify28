-- Platform error tickets — visible in the admin panel.
-- Created automatically when critical platform errors occur (e.g. campaign send failure).

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  kind text not null default 'error'
    check (kind in ('error', 'warning', 'info')),
  title text not null,
  message text not null,
  context jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tickets_resolved on public.tickets (resolved, created_at desc);
create index idx_tickets_user on public.tickets (user_id);
create index idx_tickets_campaign on public.tickets (campaign_id);

alter table public.tickets enable row level security;

-- Admins can read and update all tickets
create policy "Admins read all tickets"
  on public.tickets for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins update all tickets"
  on public.tickets for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role can insert tickets (used by server-side functions with admin client)
create policy "Service role insert tickets"
  on public.tickets for insert
  with check (true);
