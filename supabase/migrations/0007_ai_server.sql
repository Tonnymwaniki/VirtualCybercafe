-- What the hosted AI server keeps between requests: the daily AI limits, the
-- cost log per feature and the search cache. Run once in the SQL Editor.
--
-- The hosted server (EAS Hosting) can't keep files, so it stores these here.
-- It calls the functions below with the public anon key plus a server key
-- that only it knows, so no one else can read the log, fill the cache or use
-- up the daily limits. Make the key once, after running this file:
--   select public.ai_new_server_key();
-- and put the text it shows in the hosting settings as AI_SERVER_KEY. Running
-- it again makes a new key and the old one stops working.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ai_server (
  id int primary key default 1 check (id = 1),
  key_hash bytea not null
);
alter table public.ai_server enable row level security;

-- Requests per phone ('device-id') and per account ('user:<id>') per day.
create table if not exists public.ai_counts (
  day date not null,
  who text not null,
  count int not null default 0,
  primary key (day, who)
);
alter table public.ai_counts enable row level security;

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  day date not null,
  feature text not null,
  model text not null,
  input int not null default 0,
  output int not null default 0,
  cache_read int not null default 0,
  cache_write int not null default 0,
  searches int not null default 0,
  cost numeric not null default 0
);
create index if not exists ai_usage_day on public.ai_usage (day);
alter table public.ai_usage enable row level security;

create table if not exists public.ai_cache (
  key text primary key,
  value jsonb not null,
  expires timestamptz not null
);
create index if not exists ai_cache_expires on public.ai_cache (expires);
alter table public.ai_cache enable row level security;

-- No policies: only the functions below (security definer) touch these tables.

create or replace function public.ai_kenya_day() returns date
language sql stable as $$ select (now() at time zone 'Africa/Nairobi')::date $$;

create or replace function public.ai_new_server_key() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  fresh text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.ai_server (id, key_hash) values (1, extensions.digest(fresh, 'sha256'))
  on conflict (id) do update set key_hash = excluded.key_hash;
  return fresh;
end $$;

create or replace function public.ai_check_key(p_key text) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_key is null or not exists (
    select 1 from public.ai_server where key_hash = extensions.digest(p_key, 'sha256')
  ) then
    raise exception 'wrong server key' using errcode = '42501';
  end if;
end $$;

-- 'ok', 'device' (a phone or account used today's requests) or 'budget'
-- (the app spent today's AI budget).
create or replace function public.ai_allow(p_key text, p_who text[], p_limit int, p_budget numeric)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform public.ai_check_key(p_key);
  if (select coalesce(sum(cost), 0) from public.ai_usage where day = public.ai_kenya_day()) >= p_budget then
    return 'budget';
  end if;
  if exists (
    select 1 from public.ai_counts
    where day = public.ai_kenya_day() and who = any(p_who) and count >= p_limit
  ) then
    return 'device';
  end if;
  return 'ok';
end $$;

-- After a request that used the AI: count it and log each Claude reply.
-- p_lines: [{feature, model, input, output, cacheRead, cacheWrite, searches, cost}]
create or replace function public.ai_finish(p_key text, p_who text[], p_lines jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  today date := public.ai_kenya_day();
begin
  perform public.ai_check_key(p_key);
  if cardinality(p_who) > 0 then
    insert into public.ai_counts (day, who, count)
    select today, left(w, 80), 1 from unnest(p_who) as w
    on conflict (day, who) do update set count = public.ai_counts.count + 1;
  end if;
  insert into public.ai_usage (day, feature, model, input, output, cache_read, cache_write, searches, cost)
  select today, left(l->>'feature', 60), left(l->>'model', 60),
    coalesce((l->>'input')::int, 0), coalesce((l->>'output')::int, 0),
    coalesce((l->>'cacheRead')::int, 0), coalesce((l->>'cacheWrite')::int, 0),
    coalesce((l->>'searches')::int, 0), coalesce((l->>'cost')::numeric, 0)
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as l
  limit 50;
  -- Keep 90 days of log and counts.
  delete from public.ai_usage where day < today - 90;
  delete from public.ai_counts where day < today - 2;
end $$;

-- Totals per feature for /api/usage.
create or replace function public.ai_summary(p_key text, p_days int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := public.ai_kenya_day();
begin
  perform public.ai_check_key(p_key);
  return jsonb_build_object(
    'totalCostUsd', (select round(coalesce(sum(cost), 0), 4) from public.ai_usage where day > today - greatest(p_days, 1)),
    'features', coalesce((
      select jsonb_object_agg(feature, jsonb_build_object(
        'calls', calls, 'input', input, 'output', output, 'searches', searches, 'cost', cost))
      from (
        select feature, count(*) as calls, sum(input + cache_read + cache_write) as input,
          sum(output) as output, sum(searches) as searches, round(sum(cost), 4) as cost
        from public.ai_usage where day > today - greatest(p_days, 1) group by feature
      ) f), '{}'::jsonb),
    'todayCostUsd', (select round(coalesce(sum(cost), 0), 4) from public.ai_usage where day = today),
    'devices', (select count(*) from public.ai_counts where day = today and who not like 'user:%'),
    'accounts', (select count(*) from public.ai_counts where day = today and who like 'user:%')
  );
end $$;

create or replace function public.ai_cache_get(p_key text, p_name text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.ai_check_key(p_key);
  return (
    select jsonb_build_object('value', value, 'expires', (extract(epoch from expires) * 1000)::bigint)
    from public.ai_cache where key = p_name and expires > now()
  );
end $$;

create or replace function public.ai_cache_set(p_key text, p_name text, p_value jsonb, p_expires_ms bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.ai_check_key(p_key);
  insert into public.ai_cache (key, value, expires)
  values (left(p_name, 300), p_value, to_timestamp(p_expires_ms / 1000.0))
  on conflict (key) do update set value = excluded.value, expires = excluded.expires;
  delete from public.ai_cache where expires < now();
end $$;

revoke all on function public.ai_new_server_key() from public, anon, authenticated;
revoke all on function public.ai_check_key(text) from public, anon, authenticated;
revoke all on function public.ai_allow(text, text[], int, numeric) from public;
revoke all on function public.ai_finish(text, text[], jsonb) from public;
revoke all on function public.ai_summary(text, int) from public;
revoke all on function public.ai_cache_get(text, text) from public;
revoke all on function public.ai_cache_set(text, text, jsonb, bigint) from public;
grant execute on function public.ai_allow(text, text[], int, numeric) to anon, authenticated;
grant execute on function public.ai_finish(text, text[], jsonb) to anon, authenticated;
grant execute on function public.ai_summary(text, int) to anon, authenticated;
grant execute on function public.ai_cache_get(text, text) to anon, authenticated;
grant execute on function public.ai_cache_set(text, text, jsonb, bigint) to anon, authenticated;
