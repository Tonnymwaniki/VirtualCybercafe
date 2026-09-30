-- Government Services: each person's ID details and task progress.
-- Run this in the Supabase SQL Editor. Only the owner can read or change a row.

create table if not exists public.id_details (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.id_details enable row level security;

drop policy if exists "Owners manage their ID details" on public.id_details;
create policy "Owners manage their ID details"
  on public.id_details for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.task_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id text not null,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table public.task_progress enable row level security;

drop policy if exists "Owners manage their task progress" on public.task_progress;
create policy "Owners manage their task progress"
  on public.task_progress for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
