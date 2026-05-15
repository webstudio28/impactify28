-- Hero banner background images for email campaigns (per-campaign, embedded in HTML).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-hero-images',
  'campaign-hero-images',
  true,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Hero images read" on storage.objects;
create policy "Hero images read"
  on storage.objects for select
  using (bucket_id = 'campaign-hero-images');

drop policy if exists "Hero images upload own folder" on storage.objects;
create policy "Hero images upload own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'campaign-hero-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Hero images update own folder" on storage.objects;
create policy "Hero images update own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'campaign-hero-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Hero images delete own folder" on storage.objects;
create policy "Hero images delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'campaign-hero-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
