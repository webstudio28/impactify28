create table if not exists short_links (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  original_url text not null,
  campaign_id  uuid references campaigns(id) on delete set null,
  user_id      uuid references auth.users(id) on delete cascade,
  clicks       integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists short_links_code_idx on short_links (code);
create index if not exists short_links_campaign_id_idx on short_links (campaign_id);

alter table short_links enable row level security;

create policy "Users manage own short links"
  on short_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
