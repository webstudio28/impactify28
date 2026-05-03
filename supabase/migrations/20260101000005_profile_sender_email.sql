-- Outbound email "From" identity (saved on profile, set from campaign wizard).

alter table public.profiles
  add column if not exists sender_email text,
  add column if not exists sender_display_name text;
