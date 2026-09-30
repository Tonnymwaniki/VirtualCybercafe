-- Locker size limit (0005_locker_quota.sql), after 0001_locker.sql.
\set ON_ERROR_STOP 1
reset role;
insert into auth.users values ('22222222-2222-2222-2222-222222222222') on conflict do nothing;
grant select, insert on storage.objects to authenticated;

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
end $$;

set test.uid = '22222222-2222-2222-2222-222222222222';
set role authenticated;
insert into storage.objects (bucket_id, name, metadata)
values ('locker', '22222222-2222-2222-2222-222222222222/Photos/1-a.jpg', '{"size": 150000000}');
select pg_temp.check(public.locker_bytes_used() = 150000000, 'counts the owner''s files');
insert into storage.objects (bucket_id, name, metadata)
values ('locker', '22222222-2222-2222-2222-222222222222/Photos/2-b.jpg', '{"size": 60000000}');
select pg_temp.check(public.locker_bytes_used() = 210000000, 'second file allowed while under the limit');

do $$ begin
  insert into storage.objects (bucket_id, name, metadata)
  values ('locker', '22222222-2222-2222-2222-222222222222/Photos/3-c.jpg', '{"size": 1000}');
  raise exception 'FAILED: an upload past 200 MB was allowed';
exception when insufficient_privilege then null;
end $$;

-- Other buckets are not limited by this rule.
insert into storage.objects (bucket_id, name, metadata)
values ('quickprint', '22222222-2222-2222-2222-222222222222/x.pdf', '{"size": 1000}');

\echo 'Locker quota: all checks passed'
