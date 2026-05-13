-- Moderation workflow: user submits → pending_approval; admin approves → ready_to_launch;
-- admin starts send → running; admin rejects → rejected + moderation_note.

alter table public.campaigns
  add column if not exists moderation_note text;

update public.campaigns
set status = 'running'
where status in ('queued', 'sending', 'scheduled');

alter table public.campaigns drop constraint if exists campaigns_status_check;

alter table public.campaigns
  add constraint campaigns_status_check
  check (
    status in (
      'draft',
      'pending_approval',
      'ready_to_launch',
      'rejected',
      'running',
      'paused',
      'completed',
      'failed',
      'cancelled'
    )
  );

comment on column public.campaigns.moderation_note is 'Shown to user when status is rejected; cleared when resubmitted for approval.';
