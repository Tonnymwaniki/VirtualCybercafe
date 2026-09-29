-- Print code rules (0004_quick_print.sql). Run after stub.sql and the
-- migration; any failed check stops with an error.
\set ON_ERROR_STOP 1
insert into auth.users values ('11111111-1111-1111-1111-111111111111');

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
end $$;

set test.uid = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select code as a_code from public.create_quick_print('11111111-1111-1111-1111-111111111111/abc-cv.pdf', 'cv.pdf', 'application/pdf', 1234, 2, 'https://x/signed', null) \gset
select code as b_code from public.create_quick_print('11111111-1111-1111-1111-111111111111/def-id.pdf', 'id.pdf', 'application/pdf', 99, 1, 'https://x/signed2', '1234') \gset
select pg_temp.check(:'a_code' ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$', 'codes are 6 characters without 0, O, 1 or I');

-- Only files in your own folder, and PINs of 4 numbers.
do $$ begin
  perform public.create_quick_print('someoneelse/x.pdf', 'x.pdf', 'application/pdf', 1, 1, 'u', null);
  raise exception 'FAILED: another user''s folder was accepted';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
end $$;
do $$ begin
  perform public.create_quick_print('11111111-1111-1111-1111-111111111111/x.pdf', 'x.pdf', 'application/pdf', 1, 1, 'u', '12');
  raise exception 'FAILED: a 2-digit PIN was accepted';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
end $$;
select code as c_code from public.create_quick_print('11111111-1111-1111-1111-111111111111/y.pdf', 'y.pdf', 'application/pdf', 1, 1, 'u', '4321') \gset

-- The cyber side: no account.
reset role;
set test.uid = '';
set role anon;
select pg_temp.check(public.open_quick_print('VC-' || :'a_code')->>'status' = 'ok', 'opens with the VC- prefix');
select pg_temp.check(public.open_quick_print(lower(:'a_code'))->>'status' = 'ok', 'opens in lower case');
select pg_temp.check(public.open_quick_print(:'b_code')->>'status' = 'pin_needed', 'asks for the PIN');
select pg_temp.check(public.open_quick_print(:'b_code', '0000')->>'status' = 'wrong_pin', 'wrong PIN is refused');
select pg_temp.check(public.open_quick_print(:'b_code', '1234')->>'status' = 'ok', 'right PIN opens');
select pg_temp.check(public.open_quick_print('ZZZZZZ')->>'status' = 'not_found', 'unknown code');
select pg_temp.check(public.open_quick_print(:'a_code', null, true)->>'status' = 'printed', 'marking printed');
select pg_temp.check(public.open_quick_print(:'a_code')->>'status' = 'not_found', 'a printed code is used up');

-- Five wrong PINs lock the code, even against the right PIN.
select public.open_quick_print(:'c_code', '1111'), public.open_quick_print(:'c_code', '1111'),
       public.open_quick_print(:'c_code', '1111'), public.open_quick_print(:'c_code', '1111'),
       public.open_quick_print(:'c_code', '1111');
select pg_temp.check(public.open_quick_print(:'c_code', '4321')->>'status' = 'locked', 'locked after 5 wrong PINs');

-- Guessing codes is slowed down after 30 misses an hour.
select count(*) from (select public.open_quick_print('AAAAA' || g) from generate_series(1, 30) g) s;
select pg_temp.check(public.open_quick_print('AAAAAA')->>'status' = 'slow_down', 'too many misses slow down');

\echo 'Print code rules: all checks passed'
