-- =============================================================================
-- YachtOps — Supabase platform wiring: Storage, Realtime, Cron
-- Each block is guarded so the core schema can also run on plain Postgres (tests).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Storage buckets
--   yacht-photos/{org_id}/{yacht_id}/{file}  — public read, owner write
--   avatars/{user_id}/{file}                  — public read, self write
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present — skipping buckets';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('yacht-photos', 'yacht-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
         ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  on conflict (id) do nothing;

  execute $p$
    create policy "yacht photos: owners upload" on storage.objects for insert to authenticated
    with check (bucket_id = 'yacht-photos'
      and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner']::public.member_role[]))
  $p$;
  execute $p$
    create policy "yacht photos: owners update" on storage.objects for update to authenticated
    using (bucket_id = 'yacht-photos'
      and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner']::public.member_role[]))
  $p$;
  execute $p$
    create policy "yacht photos: owners delete" on storage.objects for delete to authenticated
    using (bucket_id = 'yacht-photos'
      and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner']::public.member_role[]))
  $p$;
  execute $p$
    create policy "avatars: self write" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  execute $p$
    create policy "avatars: self update" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
  execute $p$
    create policy "avatars: self delete" on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
end $$;

-- -----------------------------------------------------------------------------
-- Realtime: calendar/dashboards refresh instantly for every authorized member.
-- postgres_changes respects RLS, so tenants never receive each other's rows.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not present — skipping';
    return;
  end if;
  alter publication supabase_realtime add table
    public.bookings, public.payments, public.yachts, public.yacht_photos,
    public.notifications, public.organization_members;
end $$;

-- -----------------------------------------------------------------------------
-- Cron: release expired options/holds + reminders every 5 minutes.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available — schedule public.run_booking_maintenance() externally';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.schedule('yachtops-booking-maintenance', '*/5 * * * *',
                        'select public.run_booking_maintenance()');
end $$;
