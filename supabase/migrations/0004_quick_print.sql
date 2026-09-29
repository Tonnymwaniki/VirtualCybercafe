-- Print at any cyber: the person uploads a PDF and gets a short code and a
-- QR code. Any cyber opens the print page (no account), types the code (and
-- the PIN if one was set), downloads the PDF and prints it.
--
-- Safety:
-- - codes are 6 random characters (about a billion possibilities) and last
--   24 hours or until the cyber taps "Printed";
-- - an optional 4-digit PIN, stored hashed; 5 wrong PINs lock the code;
-- - each network address gets 30 failed lookups an hour;
-- - the cyber only ever gets a link to that one file, which stops working
--   after 24 hours; the app deletes printed and expired files.
-- Run this once in the Supabase SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.quick_prints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  code text not null unique,
  file_path text not null,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  bytes int not null default 0,
  pages int not null default 1,
  -- A signed link to the file, made by the owner's app, valid 24 hours.
  url text not null,
  pin_hash text,
  failed_pins int not null default 0,
  expires_at timestamptz not null default now() + interval '24 hours',
  opened_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.quick_prints enable row level security;

-- Owners see and remove their own codes. Codes are only made and opened
-- through the functions below.
create policy "Quick prints: owners see theirs"
  on public.quick_prints for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Quick prints: owners remove theirs"
  on public.quick_prints for delete to authenticated
  using (user_id = (select auth.uid()));

-- Failed lookups, for the per-address limit. No one reads this directly.
create table if not exists public.quick_print_misses (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists quick_print_misses_ip_at on public.quick_print_misses (ip, at);
alter table public.quick_print_misses enable row level security;

create or replace function public.quick_print_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1), ''),
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    'unknown'
  );
$$;

-- Makes a code for a file the signed-in person uploaded to their folder in
-- the quickprint bucket.
create or replace function public.create_quick_print(
  p_file_path text,
  p_file_name text,
  p_mime_type text,
  p_bytes int,
  p_pages int,
  p_url text,
  p_pin text default null
)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  new_code text;
  raw bytea;
  i int;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if split_part(p_file_path, '/', 1) <> auth.uid()::text then
    raise exception 'That file is not yours';
  end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4}$' then
    raise exception 'The PIN must be 4 digits';
  end if;
  -- At most 20 live codes per person.
  if (select count(*) from public.quick_prints q
      where q.user_id = auth.uid() and q.printed_at is null and q.expires_at > now()) >= 20 then
    raise exception 'Too many print codes are open. Cancel some first.';
  end if;

  loop
    raw := extensions.gen_random_bytes(6);
    new_code := '';
    for i in 0..5 loop
      new_code := new_code || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.quick_prints q where q.code = new_code);
  end loop;

  return query
  insert into public.quick_prints as q (user_id, code, file_path, file_name, mime_type, bytes, pages, url, pin_hash)
  values (
    auth.uid(), new_code, p_file_path, left(p_file_name, 120), p_mime_type, greatest(p_bytes, 0), greatest(p_pages, 1), p_url,
    case when p_pin is null then null else extensions.crypt(p_pin, extensions.gen_salt('bf')) end
  )
  returning q.id, q.code, q.expires_at;
end;
$$;

-- The print page: checks the code (and PIN) and returns the file's link.
-- status: ok, not_found, pin_needed, wrong_pin, locked, slow_down.
-- p_finish = true marks it printed, after which the code stops working.
create or replace function public.open_quick_print(p_code text, p_pin text default null, p_finish boolean default false)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip text := public.quick_print_ip();
  -- "VC-7K2M9Q", "vc 7k2m9q" and "7K2M9Q" all work.
  wanted text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  rec public.quick_prints%rowtype;
begin
  if length(wanted) = 8 and left(wanted, 2) = 'VC' then
    wanted := substr(wanted, 3);
  end if;
  delete from public.quick_print_misses m where m.at < now() - interval '1 hour';
  if (select count(*) from public.quick_print_misses m where m.ip = v_ip) >= 30 then
    return json_build_object('status', 'slow_down');
  end if;

  select * into rec from public.quick_prints q
  where q.code = wanted and q.printed_at is null and q.expires_at > now();
  if rec.id is null then
    insert into public.quick_print_misses (ip) values (v_ip);
    return json_build_object('status', 'not_found');
  end if;

  if rec.pin_hash is not null then
    if rec.failed_pins >= 5 then
      return json_build_object('status', 'locked');
    end if;
    if coalesce(p_pin, '') = '' then
      return json_build_object('status', 'pin_needed');
    end if;
    if extensions.crypt(p_pin, rec.pin_hash) <> rec.pin_hash then
      update public.quick_prints q set failed_pins = q.failed_pins + 1 where q.id = rec.id;
      insert into public.quick_print_misses (ip) values (v_ip);
      return json_build_object('status', 'wrong_pin', 'tries_left', greatest(0, 4 - rec.failed_pins));
    end if;
  end if;

  if p_finish then
    update public.quick_prints q set printed_at = now() where q.id = rec.id;
    return json_build_object('status', 'printed');
  end if;

  update public.quick_prints q set opened_at = coalesce(q.opened_at, now()) where q.id = rec.id;
  return json_build_object(
    'status', 'ok',
    'file_name', rec.file_name,
    'mime_type', rec.mime_type,
    'bytes', rec.bytes,
    'pages', rec.pages,
    'url', rec.url,
    'expires_at', rec.expires_at
  );
end;
$$;

revoke all on function public.create_quick_print(text, text, text, int, int, text, text) from public, anon;
grant execute on function public.create_quick_print(text, text, text, int, int, text, text) to authenticated;
revoke all on function public.open_quick_print(text, text, boolean) from public;
grant execute on function public.open_quick_print(text, text, boolean) to anon, authenticated;
revoke all on function public.quick_print_ip() from public, anon, authenticated;

-- The files, at <user id>/<random>-<name>. Only the owner can touch them;
-- the cyber gets a signed link through open_quick_print.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quickprint', 'quickprint', false, 20971520, array['application/pdf']) -- 20 MB
on conflict (id) do nothing;

create policy "Quick print files: owners upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'quickprint' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Quick print files: owners read"
  on storage.objects for select to authenticated
  using (bucket_id = 'quickprint' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Quick print files: owners remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'quickprint' and (storage.foldername(name))[1] = (select auth.uid())::text);
