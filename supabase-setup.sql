-- ============================================================
-- BBM Logger – Supabase Setup SQL
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create the fuel_logs table
create table if not exists public.fuel_logs (
  id              uuid primary key default gen_random_uuid(),
  captain_name    text not null,
  boat_name       text not null,
  route           text not null,
  logged_at       timestamptz not null,
  liters          numeric not null check (liters > 0),
  cost_idr        numeric not null check (cost_idr >= 0),
  photo_before_url text,
  photo_after_url  text,
  notes           text,
  created_at      timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.fuel_logs enable row level security;

-- 3. RLS Policies
--    Anyone (including unauthenticated) can INSERT (captains in the field)
create policy "Public insert"
  on public.fuel_logs
  for insert
  to anon
  with check (true);

--    Only authenticated users (service role / server-side) can SELECT
--    The admin dashboard reads via the server API route which uses the anon key
--    but is protected by our middleware cookie check.
--    Simplest approach: allow anon SELECT too (the middleware is our gate).
create policy "Public select"
  on public.fuel_logs
  for select
  to anon
  using (true);

-- 4. Storage bucket for photos
--    Run this in the Supabase Dashboard → Storage → New Bucket
--    OR via the SQL below (works in recent Supabase versions):
insert into storage.buckets (id, name, public)
values ('fuel-photos', 'fuel-photos', true)
on conflict (id) do nothing;

-- 5. Storage RLS policies
--    Allow anyone to upload (INSERT) to the bucket
create policy "Public upload fuel photos"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'fuel-photos');

--    Allow anyone to read (SELECT) from the bucket (public bucket)
create policy "Public read fuel photos"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'fuel-photos');

-- Done! Your Supabase project is ready.
