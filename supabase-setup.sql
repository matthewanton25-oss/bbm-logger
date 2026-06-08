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

-- 2. Captains list
create table if not exists public.captains (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique
);

-- 3. Boats list
create table if not exists public.boats (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique
);

-- 4. Seed default captains
insert into public.captains (name) values
  ('Budi Santoso'), ('Agus Wijaya'), ('Rudi Hartono'),
  ('Hendra Kusuma'), ('Dedi Prasetyo'), ('Eko Setiawan'),
  ('Bambang Suryadi'), ('Joko Purnomo'), ('Slamet Rahardjo'),
  ('Wahyu Nugroho')
on conflict (name) do nothing;

-- 5. Seed default boats
insert into public.boats (name) values
  ('KM Rajawali'), ('KM Garuda'), ('KM Elang'),
  ('KM Nusantara'), ('KM Bahari'), ('KM Samudra'),
  ('KM Cakrawala'), ('KM Merpati'), ('KM Pelita'),
  ('KM Bintang Laut')
on conflict (name) do nothing;

-- 6. Enable RLS on all tables
alter table public.fuel_logs enable row level security;
alter table public.captains enable row level security;
alter table public.boats enable row level security;

-- 7. RLS Policies for fuel_logs
create policy "Public insert fuel_logs"
  on public.fuel_logs for insert to anon with check (true);
create policy "Public select fuel_logs"
  on public.fuel_logs for select to anon using (true);
create policy "Public delete fuel_logs"
  on public.fuel_logs for delete to anon using (true);

-- 8. RLS Policies for captains
create policy "Public select captains"
  on public.captains for select to anon using (true);
create policy "Public insert captains"
  on public.captains for insert to anon with check (true);
create policy "Public delete captains"
  on public.captains for delete to anon using (true);

-- 9. RLS Policies for boats
create policy "Public select boats"
  on public.boats for select to anon using (true);
create policy "Public insert boats"
  on public.boats for insert to anon with check (true);
create policy "Public delete boats"
  on public.boats for delete to anon using (true);

-- 10. Storage bucket for photos
insert into storage.buckets (id, name, public)
values ('fuel-photos', 'fuel-photos', true)
on conflict (id) do nothing;

create policy "Public upload fuel photos"
  on storage.objects for insert to anon
  with check (bucket_id = 'fuel-photos');
create policy "Public read fuel photos"
  on storage.objects for select to anon
  using (bucket_id = 'fuel-photos');
