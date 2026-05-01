-- Campaign send UX: running / paused, rate window columns, outbound updated_at, RPC rate limit (50 SMS / minute / campaign).

alter table public.campaigns drop constraint if exists campaigns_status_check;

update public.campaigns
set status = 'running'
where status in ('queued', 'sending', 'scheduled');

alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'running', 'paused', 'completed', 'failed', 'cancelled'));

alter table public.campaigns
  add column if not exists send_rate_minute bigint,
  add column if not exists send_rate_count int not null default 0;

alter table public.outbound_sms
  add column if not exists updated_at timestamptz not null default now();

update public.outbound_sms set updated_at = coalesce(updated_at, created_at);

-- 50 sends per UTC minute per campaign (reservation before send; rollback on failure).
create or replace function public.campaign_rate_try(p_campaign uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_min bigint;
  v_min bigint;
  v_cnt int;
  owner uuid;
  trusted boolean := false;
begin
  select user_id into owner from public.campaigns where id = p_campaign for update;
  if owner is null then
    return false;
  end if;

  if (select auth.role()) = 'service_role' then
    trusted := true;
  elsif auth.uid() is not null and auth.uid() = owner then
    trusted := true;
  end if;

  if not trusted then
    return false;
  end if;

  cur_min := (extract(epoch from timezone('utc', now()))::bigint / 60);

  select send_rate_minute, send_rate_count into v_min, v_cnt
  from public.campaigns where id = p_campaign;

  if v_min is null or v_min is distinct from cur_min then
    update public.campaigns
    set send_rate_minute = cur_min, send_rate_count = 1, updated_at = now()
    where id = p_campaign;
    return true;
  end if;

  if coalesce(v_cnt, 0) >= 50 then
    return false;
  end if;

  update public.campaigns
  set send_rate_count = coalesce(v_cnt, 0) + 1, updated_at = now()
  where id = p_campaign;

  return true;
end;
$$;

create or replace function public.campaign_rate_rollback(p_campaign uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  trusted boolean := false;
begin
  select user_id into owner from public.campaigns where id = p_campaign for update;
  if owner is null then
    return;
  end if;

  if (select auth.role()) = 'service_role' then
    trusted := true;
  elsif auth.uid() is not null and auth.uid() = owner then
    trusted := true;
  end if;

  if not trusted then
    return;
  end if;

  update public.campaigns
  set send_rate_count = greatest(0, coalesce(send_rate_count, 0) - 1), updated_at = now()
  where id = p_campaign;
end;
$$;

revoke all on function public.campaign_rate_try(uuid) from public;
revoke all on function public.campaign_rate_rollback(uuid) from public;

grant execute on function public.campaign_rate_try(uuid) to authenticated, service_role;
grant execute on function public.campaign_rate_rollback(uuid) to authenticated, service_role;
