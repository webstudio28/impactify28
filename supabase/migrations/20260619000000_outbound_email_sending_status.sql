-- Allow email workers to claim rows before calling Resend.
-- Without this in-flight status, concurrent cron/QStash workers can send the same pending row.
alter table public.outbound_email
  drop constraint if exists outbound_email_status_check;

alter table public.outbound_email
  add constraint outbound_email_status_check
  check (status in ('pending', 'sending', 'sent', 'failed'));
