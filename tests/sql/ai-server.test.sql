-- The hosted AI server's limits, log and cache (0007_ai_server.sql).
\set ON_ERROR_STOP 1
reset role;
create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
end $$;

create temp table k as select public.ai_new_server_key() as key;
grant select on k to anon;
select pg_temp.check(length(key) = 48, 'key is 48 hex characters') from k;

set role anon;
-- Without the key nothing works, and the tables can't be read.
do $$ begin
  perform public.ai_allow('guess', array['phone-1'], 2, 1);
  raise exception 'FAILED: wrong key accepted';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.ai_new_server_key();
  raise exception 'FAILED: anon made a new key';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform * from public.ai_usage;
  raise exception 'FAILED: anon read the log';
exception when insufficient_privilege then null;
end $$;

-- Limits: 2 requests per phone or account, then 'device'.
select pg_temp.check(public.ai_allow(key, array['phone-1', 'user:a'], 2, 1) = 'ok', 'first allowed') from k;
select public.ai_finish(key, array['phone-1', 'user:a'],
  '[{"feature": "jobs.tailor", "model": "claude-haiku-4-5", "input": 1000, "output": 500, "cost": 0.004}]') from k;
select public.ai_finish(key, array['phone-2', 'user:a'], '[]') from k;
select pg_temp.check(public.ai_allow(key, array['phone-1'], 2, 1) = 'ok', 'phone-1 still has one') from k;
select pg_temp.check(public.ai_allow(key, array['phone-3', 'user:a'], 2, 1) = 'device', 'account used up on a new phone') from k;
-- Budget.
select public.ai_finish(key, array['phone-9'], '[{"feature": "chat", "model": "claude-opus-5", "cost": 1.5}]') from k;
select pg_temp.check(public.ai_allow(key, array['phone-5'], 40, 1) = 'budget', 'budget reached') from k;

-- Summary.
select pg_temp.check((public.ai_summary(key, 7)->'features'->'jobs.tailor'->>'calls')::int = 1, 'summary per feature') from k;
select pg_temp.check((public.ai_summary(key, 7)->>'accounts')::int = 1, 'one account today') from k;

-- Cache.
select public.ai_cache_set(key, 'visa:ke-uk', '{"visa": true}', (extract(epoch from now() + interval '1 hour') * 1000)::bigint) from k;
select public.ai_cache_set(key, 'old', '{"x": 1}', (extract(epoch from now() - interval '1 hour') * 1000)::bigint) from k;
select pg_temp.check(public.ai_cache_get(key, 'visa:ke-uk')->'value'->>'visa' = 'true', 'cache hit') from k;
select pg_temp.check(public.ai_cache_get(key, 'old') is null, 'expired entry not returned') from k;

-- A new key replaces the old one.
reset role;
create temp table k2 as select public.ai_new_server_key() as key;
grant select on k2 to anon;
set role anon;
do $$ begin
  perform public.ai_summary((select key from k), 7);
  raise exception 'FAILED: old key still works';
exception when insufficient_privilege then null;
end $$;
select pg_temp.check(public.ai_summary(key, 7) is not null, 'new key works') from k2;

reset role;
select 'AI server store: all checks passed';
