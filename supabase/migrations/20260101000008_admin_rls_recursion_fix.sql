-- Admin RLS policies in 00007 used EXISTS (SELECT … FROM profiles …), which re-applies
-- RLS on profiles inside the subquery and can cause infinite recursion or failed selects.
-- Replace with a SECURITY DEFINER helper that reads profiles without RLS.

create or replace function public.auth_is_impactify_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid() limit 1),
    false
  );
$$;

revoke all on function public.auth_is_impactify_admin() from public;
grant execute on function public.auth_is_impactify_admin() to authenticated;
grant execute on function public.auth_is_impactify_admin() to service_role;

drop policy if exists "Admins read all profiles" on public.profiles;
drop policy if exists "Admins read all audiences" on public.audiences;
drop policy if exists "Admins read all audience members" on public.audience_members;
drop policy if exists "Admins read all campaigns" on public.campaigns;
drop policy if exists "Admins read all campaign steps" on public.campaign_steps;
drop policy if exists "Admins read all outbound sms" on public.outbound_sms;
drop policy if exists "Admins read all outbound email" on public.outbound_email;

create policy "Admins read all profiles"
  on public.profiles for select
  using (public.auth_is_impactify_admin());

create policy "Admins read all audiences"
  on public.audiences for select
  using (public.auth_is_impactify_admin());

create policy "Admins read all audience members"
  on public.audience_members for select
  using (public.auth_is_impactify_admin());

create policy "Admins read all campaigns"
  on public.campaigns for select
  using (public.auth_is_impactify_admin());

create policy "Admins read all campaign steps"
  on public.campaign_steps for select
  using (public.auth_is_impactify_admin());

create policy "Admins read all outbound sms"
  on public.outbound_sms for select
  using (public.auth_is_impactify_admin());

create policy "Admins read all outbound email"
  on public.outbound_email for select
  using (public.auth_is_impactify_admin());

-- Allow users to create their profile row if the auth trigger did not run (fixes FK on campaigns.user_id).
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
