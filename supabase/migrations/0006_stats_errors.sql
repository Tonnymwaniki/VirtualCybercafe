-- Privacy-friendly stats and error reports. Run once in the SQL Editor.
--
-- Stats count steps, not people: each row is (day, event name, count), with
-- no user id, phone id or address. Error reports keep what broke and where,
-- with long numbers masked. Only people listed in app_admins can read them,
-- on the app's /admin page. Add yourself once, after signing in to the app:
--   insert into public.app_admins (user_id)
--   select id from auth.users where phone = '2547XXXXXXXX';

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.app_admins enable row level security;

create table if not exists public.app_stats (
  day date not null,
  name text not null,
  count int not null default 0,
  primary key (day, name)
);
alter table public.app_stats enable row level security;

create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  place text not null,
  message text not null,
  platform text not null default '',
  version text not null default ''
);
create index if not exists app_errors_at on public.app_errors (at desc);
alter table public.app_errors enable row level security;

-- Report attempts per address, to stop floods. No one reads this directly.
create table if not exists public.app_report_log (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists app_report_log_ip_at on public.app_report_log (ip, at);
alter table public.app_report_log enable row level security;

create or replace function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()));
$$;

-- True when this address may report again (100 reports an hour).
create or replace function public.app_report_allowed()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip text := public.quick_print_ip();
begin
  delete from public.app_report_log l where l.at < now() - interval '1 hour';
  if (select count(*) from public.app_report_log l where l.ip = v_ip) >= 100 then
    return false;
  end if;
  insert into public.app_report_log (ip) values (v_ip);
  return true;
end;
$$;

-- Adds counts for today, e.g. {"workbench.shrink_pdf": 2, "print.code_made": 1}.
-- Names are short lowercase words with dots; anything else is ignored.
create or replace function public.count_events(p_events jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  n int;
begin
  if jsonb_typeof(p_events) <> 'object' or not public.app_report_allowed() then
    return;
  end if;
  for item in select key, value from jsonb_each(p_events) limit 30 loop
    continue when item.key !~ '^[a-z0-9_]{1,30}(\.[a-z0-9_]{1,30}){0,2}$' or jsonb_typeof(item.value) <> 'number';
    n := least(greatest((item.value)::text::int, 0), 50);
    continue when n = 0;
    insert into public.app_stats as s (day, name, count)
    values ((now() at time zone 'Africa/Nairobi')::date, item.key, n)
    on conflict (day, name) do update set count = s.count + excluded.count;
  end loop;
end;
$$;

-- Saves an error report. Numbers of 6 or more digits (phones, IDs) are masked.
create or replace function public.report_error(p_place text, p_message text, p_platform text default '', p_version text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.app_report_allowed() then
    return;
  end if;
  insert into public.app_errors (place, message, platform, version)
  values (
    left(regexp_replace(coalesce(p_place, ''), '\d{6,}', '######', 'g'), 120),
    left(regexp_replace(coalesce(p_message, ''), '\d{6,}', '######', 'g'), 1000),
    left(coalesce(p_platform, ''), 20),
    left(coalesce(p_version, ''), 20)
  );
end;
$$;

-- For the /admin page: totals per event per day, and recent errors.
create or replace function public.admin_stats(p_days int default 7)
returns table (day date, name text, count int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select s.day, s.name, s.count from public.app_stats s
    where s.day > (now() at time zone 'Africa/Nairobi')::date - least(greatest(p_days, 1), 90)
    order by s.day desc, s.count desc;
end;
$$;

create or replace function public.admin_errors(p_limit int default 50)
returns table (at timestamptz, place text, message text, platform text, version text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select e.at, e.place, e.message, e.platform, e.version from public.app_errors e
    order by e.at desc limit least(greatest(p_limit, 1), 200);
end;
$$;

revoke all on function public.app_is_admin(), public.app_report_allowed() from public, anon, authenticated;
grant execute on function public.app_is_admin() to authenticated;
revoke all on function public.count_events(jsonb), public.report_error(text, text, text, text) from public;
grant execute on function public.count_events(jsonb), public.report_error(text, text, text, text) to anon, authenticated;
revoke all on function public.admin_stats(int), public.admin_errors(int) from public, anon;
grant execute on function public.admin_stats(int), public.admin_errors(int) to authenticated;
