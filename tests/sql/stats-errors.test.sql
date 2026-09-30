-- Stats and error reports (0006_stats_errors.sql), after 0004 (address helper).
\set ON_ERROR_STOP 1
reset role;
insert into auth.users values ('33333333-3333-3333-3333-333333333333') on conflict do nothing;
insert into auth.users values ('44444444-4444-4444-4444-444444444444') on conflict do nothing;
insert into public.app_admins values ('33333333-3333-3333-3333-333333333333');

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
end $$;

set test.uid = '';
set role anon;
select public.count_events('{"workbench.shrink_pdf": 2, "print.code_made": 1, "Bad Name!": 5, "chat.sent": "x"}');
select public.count_events('{"workbench.shrink_pdf": 1000}');
select public.report_error('studio/print', 'Crash for 0712345678 with ID 12345678', 'android', '1.0.0');
do $$ begin
  perform * from public.app_stats;
  raise exception 'FAILED: anon read the stats table';
exception when insufficient_privilege then null;
end $$;

reset role;
set test.uid = '44444444-4444-4444-4444-444444444444';
set role authenticated;
do $$ begin
  perform * from public.admin_stats(7);
  raise exception 'FAILED: a non-admin read the stats';
exception when insufficient_privilege then null;
end $$;

reset role;
set test.uid = '33333333-3333-3333-3333-333333333333';
set role authenticated;
select pg_temp.check((select count from public.admin_stats(7) where name = 'workbench.shrink_pdf') = 52, 'counts add up, capped at 50 per report');
select pg_temp.check((select count(*) from public.admin_stats(7)) = 2, 'bad names and values are ignored');
select pg_temp.check((select message from public.admin_errors(5) limit 1) = 'Crash for ###### with ID ######', 'long numbers are masked');

\echo 'Stats and error reports: all checks passed'
