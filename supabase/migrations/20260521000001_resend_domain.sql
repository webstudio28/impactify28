-- Store the Resend domain registration for each profile's sender domain.
-- resend_domain_id: the ID returned by POST /domains, used for status checks.
-- resend_domain_records: JSONB array of DNS records the user must add to verify.
-- resend_domain_status: mirrors Resend's status field (pending / verified / failure / …).

alter table public.profiles
  add column if not exists resend_domain_id     text,
  add column if not exists resend_domain_status text,
  add column if not exists resend_domain_records jsonb;
