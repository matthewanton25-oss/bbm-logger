-- =============================================================================
-- YachtOps — demo fleet loader
-- Lets a brand-new owner populate their workspace with a realistic sample fleet
-- (5 yachts, bookings across every status, payment history, a maintenance block).
-- Dates are relative to "today" in the organization's timezone.
-- =============================================================================
create or replace function public.seed_demo_fleet(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tz      text;
  v_today   date;
  y_azura   uuid; y_nusa uuid; y_bintang uuid; y_kanaya uuid; y_seraya uuid;
  b         uuid;
  v_img     text := 'https://images.unsplash.com/';
begin
  if not public.has_org_role(p_org, array['owner']::public.member_role[]) then
    raise exception 'Only owners can load the demo fleet' using errcode = '42501';
  end if;
  if exists (select 1 from public.yachts where org_id = p_org) then
    raise exception 'Demo fleet can only be loaded into an empty workspace' using errcode = '22023';
  end if;

  select timezone into v_tz from public.organizations where id = p_org;
  v_today := (now() at time zone v_tz)::date;

  -- ---------------------------------------------------------------- yachts
  insert into public.yachts (org_id, name, yacht_type, length_m, capacity, home_marina, description, registration_number, created_by)
  values (p_org, 'Azura', 'Phinisi', 32, 40, 'Marina Ancol, Jakarta',
          'Hand-built ironwood phinisi with 4 cabins, sundeck lounge and onboard chef. Ideal for Thousand Islands day trips and overnight Sepa Island escapes.',
          'GT.185 No.2231/Ba', auth.uid())
  returning id into y_azura;
  insert into public.yachts (org_id, name, yacht_type, length_m, capacity, home_marina, description, registration_number, created_by)
  values (p_org, 'Nusa Breeze', 'Sailing Catamaran', 15.2, 25, 'Marina Ancol, Jakarta',
          'Stable twin-hull catamaran with trampoline net, snorkel gear and paddle boards. Popular for families and sunset sails.',
          'GT.42 No.1187/Ka', auth.uid())
  returning id into y_nusa;
  insert into public.yachts (org_id, name, yacht_type, length_m, capacity, home_marina, description, registration_number, created_by)
  values (p_org, 'Bintang Laut', 'Motor Yacht', 24, 30, 'Serangan Marina, Bali',
          'Twin-engine flybridge motor yacht with air-conditioned salon, premium sound system and jet ski tender.',
          'GT.98 No.3310/Ba', auth.uid())
  returning id into y_bintang;
  insert into public.yachts (org_id, name, yacht_type, length_m, capacity, home_marina, description, created_by)
  values (p_org, 'Kanaya', 'Sport Cruiser', 12.5, 12, 'Marina Ancol, Jakarta',
          'Fast sport cruiser for private island hopping, proposals and photo shoots.', auth.uid())
  returning id into y_kanaya;
  insert into public.yachts (org_id, name, yacht_type, length_m, capacity, home_marina, description, created_by)
  values (p_org, 'Seraya Explorer', 'Speedboat', 10, 18, 'Marina Ancol, Jakarta',
          'Twin 250hp transfer speedboat. Ancol → Sepa Island in 75 minutes.', auth.uid())
  returning id into y_seraya;

  insert into public.yacht_photos (yacht_id, url, position) values
    (y_azura,   v_img || 'photo-1567899378494-47b22a2ae96a?w=1200&q=80', 0),
    (y_nusa,    v_img || 'photo-1544551763-46a013bb70d5?w=1200&q=80', 0),
    (y_bintang, v_img || 'photo-1605281317010-fe5ffe798166?w=1200&q=80', 0),
    (y_kanaya,  v_img || 'photo-1569263979104-865ab7cd8d13?w=1200&q=80', 0),
    (y_seraya,  v_img || 'photo-1540946485063-a40da27545f8?w=1200&q=80', 0);

  -- ---------------------------------------------------------------- bookings
  -- Azura: PAID corporate day trip today
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, customer_email, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, deposit_amount, notes)
  values (y_azura, 'hold', 'Hendra Wijaya (PT Samudra Logistik)', '+62 812 8890 1123', 'hendra@samudralogistik.co.id',
      (v_today + time '08:00') at time zone v_tz, (v_today + time '17:00') at time zone v_tz,
      'Marina Ancol Dermaga 17', 'Sepa Island', 34, 45000000, 15000000, 'Corporate outing. Lunch buffet + snorkeling. Halal catering.')
  returning id into b;
  insert into public.payments (booking_id, amount, method, paid_at, reference, notes)
  values (b, 15000000, 'bank_transfer', now() - interval '12 days', 'BCA-TRF-88120', 'Deposit 1/3');
  insert into public.payments (booking_id, amount, method, paid_at, reference, notes)
  values (b, 30000000, 'bank_transfer', now() - interval '2 days', 'BCA-TRF-90433', 'Final settlement');

  -- Azura: DOWN PAYMENT overnight charter in 3 days (multi-day)
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, customer_email, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, deposit_amount, notes)
  values (y_azura, 'hold', 'Sophie Laurent', '+33 6 12 34 56 78', 'sophie.laurent@gmail.com',
      (v_today + 3 + time '10:00') at time zone v_tz, (v_today + 4 + time '16:00') at time zone v_tz,
      'Marina Ancol Dermaga 17', 'Sepa Island overnight', 8, 68000000, 20000000, 'Anniversary. Flowers + cake on board, vegetarian menu for 2 guests.')
  returning id into b;
  insert into public.payments (booking_id, amount, method, paid_at, reference, notes)
  values (b, 20000000, 'card', now() - interval '5 days', 'STRIPE-ch_3PxA9', 'Deposit 30%');

  -- Nusa Breeze: OPTION today (expires in ~20h)
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, expires_at, notes)
  values (y_nusa, 'option', 'Rina Kusuma', '+62 813 1002 7781',
      (v_today + time '15:00') at time zone v_tz, (v_today + time '19:00') at time zone v_tz,
      'Marina Ancol Dermaga 9', 'Sunset sail – Pulau Bidadari', 14, 18000000, now() + interval '20 hours',
      'Birthday sunset cruise. Waiting for confirmation from family.');

  -- Nusa Breeze: HOLD tomorrow
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, deposit_amount, expires_at, notes)
  values (y_nusa, 'hold', 'Michael Tan', '+65 9123 4567',
      (v_today + 1 + time '09:00') at time zone v_tz, (v_today + 1 + time '15:00') at time zone v_tz,
      'Marina Ancol Dermaga 9', 'Pulau Macan', 20, 22000000, 7000000, now() + interval '30 hours',
      'Team offsite. Deposit invoice sent.');

  -- Bintang Laut: PAID sunset in 2 days
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, customer_email, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, deposit_amount, notes)
  values (y_bintang, 'hold', 'Ayu Pratiwi', '+62 811 3920 556', 'ayu.pratiwi@outlook.com',
      (v_today + 2 + time '16:00') at time zone v_tz, (v_today + 2 + time '20:00') at time zone v_tz,
      'Serangan Marina', 'Nusa Dua sunset', 16, 35000000, 10000000, 'Engagement dinner on deck. Photographer joins.')
  returning id into b;
  insert into public.payments (booking_id, amount, method, paid_at, reference)
  values (b, 35000000, 'bank_transfer', now() - interval '1 day', 'MANDIRI-552190');

  -- Bintang Laut: OPTION in 5 days
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, expires_at, notes)
  values (y_bintang, 'option', 'James Whitfield', '+61 412 555 019',
      (v_today + 5 + time '09:00') at time zone v_tz, (v_today + 5 + time '17:00') at time zone v_tz,
      'Serangan Marina', 'Nusa Penida – Manta Point', 12, 38000000, now() + interval '2 days',
      'Broker lead via Bali Yacht Co. Asked for dive guide.');

  -- Bintang Laut: maintenance block
  insert into public.bookings (yacht_id, status, starts_at, ends_at, block_reason, notes)
  values (y_bintang, 'blocked',
      (v_today + 8 + time '00:00') at time zone v_tz, (v_today + 11 + time '00:00') at time zone v_tz,
      'Maintenance', 'Annual engine service + antifouling at Benoa shipyard.');

  -- Kanaya: HOLD in 4 days, available today
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, deposit_amount, expires_at, notes)
  values (y_kanaya, 'hold', 'Daniel Hartono', '+62 878 7712 0090',
      (v_today + 4 + time '14:00') at time zone v_tz, (v_today + 4 + time '18:00') at time zone v_tz,
      'Marina Ancol Dermaga 3', 'Pulau Ayer', 6, 12000000, 4000000, now() + interval '3 days',
      'Proposal! Keep it secret – contact only via WhatsApp.');

  -- Seraya Explorer: DOWN PAYMENT transfer tomorrow
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, deposit_amount, notes)
  values (y_seraya, 'hold', 'Sepa Island Resort – Guest Transfer', '+62 21 6471 2020',
      (v_today + 1 + time '07:30') at time zone v_tz, (v_today + 1 + time '10:00') at time zone v_tz,
      'Marina Ancol Dermaga 17', 'Sepa Island', 16, 6500000, 3000000, 'Round trip, return pickup 10:00 next day handled separately.')
  returning id into b;
  insert into public.payments (booking_id, amount, method, paid_at, reference)
  values (b, 3000000, 'bank_transfer', now() - interval '3 days', 'BCA-TRF-87001');

  -- Seraya Explorer: past PAID trip (history)
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, notes)
  values (y_seraya, 'paid', 'Kevin Santoso', '+62 815 6600 1212',
      (v_today - 3 + time '08:00') at time zone v_tz, (v_today - 3 + time '12:00') at time zone v_tz,
      'Marina Ancol Dermaga 17', 'Pulau Pari', 10, 6500000, 'Fishing trip.');

  -- Seraya Explorer: cancelled booking (history)
  insert into public.bookings (yacht_id, status, customer_name, customer_phone, starts_at, ends_at,
      pickup_location, destination, passengers, total_price, expires_at)
  values (y_seraya, 'option', 'Linda Gunawan', '+62 812 4400 3311',
      (v_today + 6 + time '09:00') at time zone v_tz, (v_today + 6 + time '13:00') at time zone v_tz,
      'Marina Ancol Dermaga 17', 'Pulau Tidung', 12, 6500000, now() + interval '1 day')
  returning id into b;
  update public.bookings set status = 'cancelled', cancel_reason = 'Weather forecast – client postponed' where id = b;

  return jsonb_build_object('yachts', 5, 'bookings',
    (select count(*) from public.bookings where org_id = p_org));
end $$;

grant execute on function public.seed_demo_fleet(uuid) to authenticated;
