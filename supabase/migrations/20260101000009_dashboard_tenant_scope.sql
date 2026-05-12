-- Session-scoped Supabase (createClient / anon JWT) was granting admins SELECT on
-- every row for audiences, campaigns, outbound queues, etc. That made /dashboard/*
-- show all tenants' data. Cross-tenant admin views already use createAdminClient()
-- (service role) under /admin and /api/admin/*.
--
-- Drop global admin read policies so RLS matches normal tenants: only own user_id.

drop policy if exists "Admins read all profiles" on public.profiles;
drop policy if exists "Admins read all audiences" on public.audiences;
drop policy if exists "Admins read all audience members" on public.audience_members;
drop policy if exists "Admins read all campaigns" on public.campaigns;
drop policy if exists "Admins read all campaign steps" on public.campaign_steps;
drop policy if exists "Admins read all outbound sms" on public.outbound_sms;
drop policy if exists "Admins read all outbound email" on public.outbound_email;

-- No remaining references; keep DB tidy (was only used by the policies above).
drop function if exists public.auth_is_impactify_admin();
