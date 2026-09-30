-- Private storage bucket for each user's Digital Locker.
-- Files live at <user id>/<category>/<timestamp>-<name>, and each user can
-- only read, add or delete files inside their own <user id>/ folder.

insert into storage.buckets (id, name, public, file_size_limit)
values ('locker', 'locker', false, 20971520) -- 20 MB per file
on conflict (id) do nothing;

create policy "Locker: owners can view their files"
  on storage.objects for select to authenticated
  using (bucket_id = 'locker' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Locker: owners can upload their files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'locker' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Locker: owners can update their files"
  on storage.objects for update to authenticated
  using (bucket_id = 'locker' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Locker: owners can delete their files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'locker' and (storage.foldername(name))[1] = (select auth.uid())::text);
