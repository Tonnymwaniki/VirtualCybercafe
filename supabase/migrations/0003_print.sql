-- Print Hub: partner print shops, print jobs, and a private "print" bucket
-- for the files being printed.
-- A customer sees only their own jobs. A shop owner sees only the jobs sent
-- to their shop, and can open a job's file only while the job is open
-- (sent, printing or ready).

create table if not exists public.print_shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  name text not null,
  town text not null,
  county text not null default '',
  hours text not null default '',
  phone text not null default '',
  price_bw numeric not null default 10 check (price_bw >= 0),
  price_colour numeric not null default 30 check (price_colour >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.print_shops enable row level security;

create policy "Print shops: anyone signed in can see active shops"
  on public.print_shops for select to authenticated
  using (active or owner_id = (select auth.uid()));

create policy "Print shops: owners add their shop"
  on public.print_shops for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Print shops: owners update their shop"
  on public.print_shops for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  shop_id uuid not null references public.print_shops on delete cascade,
  code text not null,
  customer_name text not null default '',
  customer_phone text not null default '',
  file_path text not null default '',
  file_name text not null,
  mime_type text not null default 'application/pdf',
  pages int not null check (pages between 1 and 500),
  copies int not null default 1 check (copies between 1 and 50),
  colour boolean not null default false,
  double_sided boolean not null default false,
  price numeric not null default 0,
  note text not null default '',
  status text not null default 'sent' check (status in ('sent', 'printing', 'ready', 'collected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A pickup code is unique among open jobs.
create unique index if not exists print_jobs_open_code
  on public.print_jobs (code) where status in ('sent', 'printing', 'ready');

alter table public.print_jobs enable row level security;

create policy "Print jobs: customers see their jobs, shops see jobs sent to them"
  on public.print_jobs for select to authenticated
  using (
    user_id = (select auth.uid())
    or shop_id in (select id from public.print_shops where owner_id = (select auth.uid()))
  );

create policy "Print jobs: customers send jobs"
  on public.print_jobs for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'sent');

create policy "Print jobs: customers and their shop update jobs"
  on public.print_jobs for update to authenticated
  using (
    user_id = (select auth.uid())
    or shop_id in (select id from public.print_shops where owner_id = (select auth.uid()))
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('print', 'print', false, 20971520) -- 20 MB per file
on conflict (id) do nothing;

-- Files live at <job id>/<file name>.
create policy "Print files: customers upload files for their jobs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'print'
    and exists (
      select 1 from public.print_jobs j
      where j.id::text = (storage.foldername(name))[1] and j.user_id = (select auth.uid())
    )
  );

create policy "Print files: open while the job is open"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'print'
    and exists (
      select 1 from public.print_jobs j
      where j.id::text = (storage.foldername(name))[1] and j.status in ('sent', 'printing', 'ready')
    )
  );

create policy "Print files: customers and shops remove files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'print'
    and exists (select 1 from public.print_jobs j where j.id::text = (storage.foldername(name))[1])
  );
