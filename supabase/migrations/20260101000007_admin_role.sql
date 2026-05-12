-- Admin role for platform superusers.
-- Manually assign role = 'admin' to a user via the Supabase dashboard or SQL:
--   UPDATE public.profiles SET role = 'admin' WHERE id = '<user-uuid>';

alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin'));

-- Admins can read all profiles (for the admin panel)
create policy "Admins read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can read all audiences
create policy "Admins read all audiences"
  on public.audiences for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can read all audience members
create policy "Admins read all audience members"
  on public.audience_members for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can read all campaigns
create policy "Admins read all campaigns"
  on public.campaigns for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can read all campaign steps
create policy "Admins read all campaign steps"
  on public.campaign_steps for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can read all outbound SMS
create policy "Admins read all outbound sms"
  on public.outbound_sms for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can read all outbound email
create policy "Admins read all outbound email"
  on public.outbound_email for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
