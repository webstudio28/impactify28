-- Expand tickets.kind to include 'critical'
alter table public.tickets
  drop constraint if exists tickets_kind_check;

alter table public.tickets
  add constraint tickets_kind_check
  check (kind in ('critical', 'error', 'warning', 'info'));

-- Partial index to efficiently find open tickets per campaign (used for deduplication)
create index if not exists idx_tickets_open_campaign
  on public.tickets (campaign_id, kind)
  where resolved = false;
