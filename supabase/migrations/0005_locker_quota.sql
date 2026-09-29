-- Locker size limit: 200 MB of files per person. The app shows how much is
-- used and warns before the limit; this rule stops uploads past it.
-- Run once in the Supabase SQL Editor, after 0001_locker.sql.

create or replace function public.locker_bytes_used()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  from storage.objects o
  where o.bucket_id = 'locker'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;

revoke all on function public.locker_bytes_used() from public, anon;
grant execute on function public.locker_bytes_used() to authenticated;

-- "as restrictive": every upload must also pass this, on top of the owner rules.
drop policy if exists "Locker: 200 MB each" on storage.objects;
create policy "Locker: 200 MB each"
  on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'locker' or public.locker_bytes_used() < 200 * 1024 * 1024);
