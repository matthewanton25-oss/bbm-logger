-- =============================================================================
-- YachtOps database test suite: tenancy, roles, conflicts, ledger, expiry.
-- Run with ./run.sh (plain Postgres + stubbed Supabase auth).
-- =============================================================================
create schema tests;
grant usage on schema tests to authenticated;

create function tests.eq(actual anyelement, expected anyelement, label text) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok  %', label;
end $$;

create function tests.expect_error(p_sql text, p_state text, label text) returns void
language plpgsql as $$
declare v_ok boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then v_ok := true;
    else raise exception 'FAIL %: expected sqlstate %, got % (%)', label, p_state, sqlstate, sqlerrm;
    end if;
  end;
  if not v_ok then raise exception 'FAIL %: expected error % but statement succeeded', label, p_state; end if;
  raise notice 'ok  %', label;
end $$;

create function tests.rows_affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;

create procedure tests.login(p_email text) language plpgsql security definer as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce((select id::text from auth.users where email = p_email), ''), false);
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, false);
end $$;
grant execute on all functions in schema tests to authenticated;
grant execute on all procedures in schema tests to authenticated;

-- -----------------------------------------------------------------------------
\echo '— signup creates private workspaces'
insert into auth.users (email, raw_user_meta_data, email_confirmed_at) values
  ('alice@azura.test', '{"full_name":"Alice Owner","company_name":"Azura Charters","phone":"+62 811"}', now()),
  ('bob@rival.test',   '{"full_name":"Bob Rival","account_type":"fleet_manager"}', now());

select tests.eq((select count(*)::int from public.organizations), 2, 'each owner gets a workspace');
select tests.eq((select o.name from public.organizations o join public.profiles p on p.default_org_id = o.id
                  where p.email = 'alice@azura.test'), 'Azura Charters', 'workspace named after company');
select tests.eq((select account_type::text from public.profiles where email = 'bob@rival.test'), 'fleet_manager', 'account type stored');

select default_org_id as alice_org from public.profiles where email = 'alice@azura.test' \gset
select default_org_id as bob_org   from public.profiles where email = 'bob@rival.test' \gset

-- -----------------------------------------------------------------------------
\echo '— demo fleet + ledger-driven status'
call tests.login('alice@azura.test');
set role authenticated;
select public.seed_demo_fleet(:'alice_org');
select tests.eq((select count(*)::int from public.yachts), 5, 'five demo yachts');
select tests.eq((select status::text from public.bookings where customer_name like 'Hendra%'), 'paid',
                'deposit + settlement payments → PAID');
select tests.eq((select status::text from public.bookings where customer_name = 'Sophie Laurent'), 'down_payment',
                'deposit payment → DOWN PAYMENT');
select tests.eq((select balance_due from public.bookings where customer_name = 'Sophie Laurent'), 48000000.00::numeric(14,2),
                'remaining balance computed');
select tests.eq((select count(*)::int from public.payments p join public.bookings b on b.id = p.booking_id
                  where b.customer_name like 'Hendra%'), 2, 'payment history kept, not overwritten');
select tests.eq((select count(*)::int from public.booking_activity where action = 'payment_recorded'), 5, 'payments audited');
select tests.expect_error($$select public.seed_demo_fleet('$$ || :'alice_org' || $$')$$, '22023', 'demo only loads into empty workspace');

-- -----------------------------------------------------------------------------
\echo '— tenant isolation'
call tests.login('bob@rival.test');
select tests.eq((select count(*)::int from public.yachts), 0, 'Bob cannot see Alice''s yachts');
select tests.eq((select count(*)::int from public.bookings), 0, 'Bob cannot see Alice''s bookings');
select tests.eq((select count(*)::int from public.payments), 0, 'Bob cannot see Alice''s payments');
reset role;
select id as azura from public.yachts where name = 'Azura' \gset
select id as kanaya from public.yachts where name = 'Kanaya' \gset
select id as nusa from public.yachts where name = 'Nusa Breeze' \gset
select id as sophie from public.bookings where customer_name = 'Sophie Laurent' \gset
select (now() at time zone 'Asia/Jakarta')::date as today \gset
set role authenticated;
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at)
  values (%L, 'option', 'Spy', now() + interval '40 days', now() + interval '40 days 4 hours')$$, :'azura'),
  '42501', 'Bob cannot book Alice''s yacht');
select tests.eq(tests.rows_affected(format($$update public.bookings set notes = 'x' where id = %L$$, :'sophie')), 0,
                'Bob cannot update Alice''s booking');
select tests.expect_error(format($$insert into public.payments (booking_id, amount) values (%L, 1)$$, :'sophie'),
  '42501', 'Bob cannot record payments on Alice''s booking');
select tests.expect_error(format($$select public.get_dashboard(%L)$$, :'alice_org'), '42501', 'Bob cannot read Alice''s dashboard');

-- -----------------------------------------------------------------------------
\echo '— conflict prevention'
call tests.login('alice@azura.test');
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at)
  values (%L, 'hold', 'Overlap', ('%s'::date + time '12:00') at time zone 'Asia/Jakarta', ('%s'::date + time '20:00') at time zone 'Asia/Jakarta')$$,
  :'azura', :'today', :'today'), '23P01', 'HOLD cannot overlap PAID');
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at)
  values (%L, 'option', 'Overlap', ('%s'::date + 3 + time '12:00') at time zone 'Asia/Jakarta', ('%s'::date + 3 + time '14:00') at time zone 'Asia/Jakarta')$$,
  :'azura', :'today', :'today'), '23P01', 'OPTION cannot sit on a confirmed slot');
-- back-to-back is fine ([) ranges)
insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at, total_price)
values (:'azura', 'hold', 'Evening guest', (:'today'::date + time '17:00') at time zone 'Asia/Jakarta',
        (:'today'::date + time '21:00') at time zone 'Asia/Jakarta', 10000000);
select tests.eq((select count(*)::int from public.bookings where customer_name = 'Evening guest'), 1, 'back-to-back booking allowed');

-- options: single by default, multiple when enabled
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at)
  values (%L, 'option', 'Second option', ('%s'::date + time '16:00') at time zone 'Asia/Jakarta', ('%s'::date + time '18:00') at time zone 'Asia/Jakarta')$$,
  :'nusa', :'today', :'today'), '23P01', 'second OPTION rejected by default');
update public.organizations set allow_multiple_options = true where id = :'alice_org';
insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at)
values (:'nusa', 'option', 'Second option', (:'today'::date + time '16:00') at time zone 'Asia/Jakarta',
        (:'today'::date + time '18:00') at time zone 'Asia/Jakarta');
select tests.eq((select count(*)::int from public.bookings where yacht_id = :'nusa' and status = 'option'
                 and period && tstzrange((:'today'::date + time '00:00') at time zone 'Asia/Jakarta', (:'today'::date + 1 + time '00:00') at time zone 'Asia/Jakarta')),
                2, 'multiple OPTIONs allowed when enabled');
update public.bookings set status = 'hold' where customer_name = 'Second option';
select tests.expect_error($$update public.bookings set status = 'hold' where customer_name = 'Rina Kusuma'$$,
  '23P01', 'two overlapping HOLDs impossible');
select tests.eq((select expires_at > now() + interval '71 hours' from public.bookings where customer_name = 'Second option'),
                true, 'OPTION→HOLD resets expiry to hold default');

-- validation
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at, passengers)
  values (%L, 'option', 'Big party', now() + interval '60 days', now() + interval '60 days 2 hours', 50)$$, :'kanaya'),
  '23514', 'capacity enforced');
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at)
  values (%L, 'option', 'Backwards', now() + interval '61 days', now() + interval '60 days')$$, :'kanaya'),
  '23514', 'end must be after start');
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at, expires_at)
  values (%L, 'option', 'Stale', now() + interval '62 days', now() + interval '62 days 2 hours', now() - interval '1 hour')$$, :'kanaya'),
  '22023', 'expiry must be in the future');

-- tampering with ledger-owned fields is ignored
update public.bookings set amount_paid = 999999999 where id = :'sophie';
select tests.eq((select amount_paid from public.bookings where id = :'sophie'), 20000000.00::numeric(14,2), 'amount_paid cannot be edited directly');
select tests.expect_error(format($$update public.payments set amount = 1 where booking_id = %L$$, :'sophie'), '42501', 'payments are append-only');
select tests.expect_error($$delete from public.booking_activity$$, '42501', 'audit log is immutable');

-- settle balance → PAID; refund → back to DP
insert into public.payments (booking_id, amount, reference) values (:'sophie', 48000000, 'FINAL-1');
select tests.eq((select status::text from public.bookings where id = :'sophie'), 'paid', 'full balance → PAID');
insert into public.payments (booking_id, kind, amount, reference) values (:'sophie', 'refund', 8000000, 'REF-1');
select tests.eq((select status::text from public.bookings where id = :'sophie'), 'down_payment', 'partial refund → DOWN PAYMENT');
select tests.eq((select balance_due from public.bookings where id = :'sophie'), 8000000.00::numeric(14,2), 'balance after refund');

-- atomic create + deposit
select tests.eq((public.create_booking(
    jsonb_build_object('yacht_id', :'kanaya', 'status', 'hold', 'customer_name', 'Atomic Guest',
                       'starts_at', now() + interval '30 days', 'ends_at', now() + interval '30 days 5 hours',
                       'total_price', 12000000, 'deposit_amount', 4000000),
    jsonb_build_object('amount', 4000000, 'reference', 'DP-ATOMIC'))).status::text, 'down_payment',
  'create_booking + deposit → DOWN PAYMENT atomically');
select tests.expect_error(format($$select public.create_booking(jsonb_build_object('yacht_id', %L, 'status', 'hold',
    'customer_name', 'Clash', 'starts_at', now() + interval '30 days 1 hour', 'ends_at', now() + interval '30 days 2 hours'),
    jsonb_build_object('amount', 1))$$, :'kanaya'), '23P01', 'atomic create rolls back on conflict');
select tests.eq((select count(*)::int from public.bookings where customer_name = 'Clash'), 0, 'no partial booking left behind');

-- maintenance block
insert into public.bookings (yacht_id, status, starts_at, ends_at, block_reason)
values (:'kanaya', 'blocked', now() + interval '90 days', now() + interval '92 days', 'Private use');
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at)
  values (%L, 'option', 'Blocked day', now() + interval '91 days', now() + interval '91 days 3 hours')$$, :'kanaya'),
  '23P01', 'blocked dates reject bookings');

-- -----------------------------------------------------------------------------
\echo '— team roles'
select tests.eq((select email::text from public.invite_member(:'alice_org', 'mia@azura.test', 'manager')), 'mia@azura.test', 'owner invites manager');
select public.invite_member(:'alice_org', 'vic@azura.test', 'viewer');
call tests.login('bob@rival.test');
select tests.expect_error(format($$select public.invite_member(%L, 'evil@x.test', 'owner')$$, :'alice_org'), '42501', 'non-owner cannot invite');
reset role;
insert into auth.users (email, raw_user_meta_data) values
  ('mia@azura.test', '{"full_name":"Mia Manager"}'), ('vic@azura.test', '{"full_name":"Vic Viewer"}');
select tests.eq((select count(*)::int from public.organizations), 2, 'invited users do not get a stray workspace');
set role authenticated;
call tests.login('mia@azura.test');
select tests.eq(public.accept_pending_invitations(), 0, 'unverified email cannot accept invitation');
reset role;
update auth.users set email_confirmed_at = now() where email in ('mia@azura.test', 'vic@azura.test');
set role authenticated;
select tests.eq(public.accept_pending_invitations(), 1, 'verified manager accepts');
call tests.login('vic@azura.test');
select tests.eq(public.accept_pending_invitations(), 1, 'verified viewer accepts');

call tests.login('mia@azura.test');
select tests.eq((select count(*)::int from public.yachts), 5, 'manager sees fleet');
insert into public.bookings (yacht_id, status, customer_name, customer_phone, starts_at, ends_at, total_price)
values (:'kanaya', 'option', 'Manager lead', '+62 1', now() + interval '20 days', now() + interval '20 days 4 hours', 12000000);
select tests.eq((select created_by from public.bookings where customer_name = 'Manager lead'), auth.uid(), 'created_by stamped server-side');
update public.bookings set status = 'hold' where customer_name = 'Manager lead';
select tests.eq((select status::text from public.bookings where customer_name = 'Manager lead'), 'hold', 'manager updates status');
select tests.expect_error(format($$insert into public.payments (booking_id, amount) values (%L, 1)$$, :'sophie'), '42501', 'manager cannot record payments');
select tests.expect_error(format($$insert into public.yachts (org_id, name, capacity) values (%L, 'Rogue', 4)$$, :'alice_org'), '42501', 'manager cannot add yachts');
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, starts_at, ends_at) values (%L, 'blocked', now() + interval '200 days', now() + interval '201 days')$$, :'kanaya'),
  '42501', 'manager cannot block dates');

call tests.login('vic@azura.test');
select tests.eq((select count(*)::int > 0 from public.bookings), true, 'viewer sees calendar');
select tests.eq(tests.rows_affected($$update public.bookings set notes = 'hacked'$$), 0, 'viewer cannot modify bookings');
select tests.expect_error(format($$insert into public.bookings (yacht_id, status, customer_name, starts_at, ends_at) values (%L, 'option', 'V', now() + interval '300 days', now() + interval '301 days')$$, :'kanaya'),
  '42501', 'viewer cannot create bookings');
select tests.eq(tests.rows_affected(format($$update public.organization_members set role = 'owner' where user_id = auth.uid()$$)), 0, 'viewer cannot self-promote');

call tests.login('alice@azura.test');
select tests.expect_error(format($$delete from public.organization_members where org_id = %L and role = 'owner'$$, :'alice_org'), '23514', 'last owner cannot be removed');

-- -----------------------------------------------------------------------------
\echo '— notifications & audit'
select tests.eq((select count(*)::int > 0 from public.booking_activity where action = 'status_changed'), true, 'status changes audited');
call tests.login('mia@azura.test');
call tests.login('alice@azura.test');
select tests.eq((select count(*)::int from public.notifications where type = 'new_booking' and body like 'Manager lead%'), 1,
                'owner notified about manager''s booking');
select tests.eq((select count(*)::int from public.notifications n where n.user_id <> auth.uid()), 0, 'users only see their own notifications');

-- -----------------------------------------------------------------------------
\echo '— automatic expiry (runs as cron: no user session)'
reset role;
call tests.login('nobody');
update public.bookings set expires_at = now() + interval '30 minutes', expiry_warned_at = null where customer_name = 'Rina Kusuma';
select public.run_booking_maintenance();
select tests.eq((select count(*)::int from public.notifications where type = 'option_expiring'), 2, 'expiry warning to owner + manager (not viewer)');
-- simulate the clock passing the deadline
alter table public.bookings disable trigger bookings_before_write;
update public.bookings set expires_at = now() - interval '1 minute' where customer_name = 'Rina Kusuma';
alter table public.bookings enable trigger bookings_before_write;
select tests.eq((public.run_booking_maintenance() ->> 'expired')::int, 1, 'maintenance expires overdue options');
select tests.eq((select status::text from public.bookings where customer_name = 'Rina Kusuma'), 'expired', 'option released → available');
select tests.eq((select count(*)::int from public.booking_activity a join public.bookings b on b.id = a.booking_id
                  where b.customer_name = 'Rina Kusuma' and a.action = 'expired' and a.actor_id is null), 1, 'expiry audited as system');
select tests.eq((select count(*)::int > 0 from public.notifications where type = 'upcoming_charter'), true, 'upcoming charter reminders sent');

-- -----------------------------------------------------------------------------
\echo '— dashboard'
set role authenticated;
call tests.login('alice@azura.test');
select tests.eq((public.get_dashboard(:'alice_org') -> 'stats' ->> 'total_yachts')::int, 5, 'dashboard total yachts');
select tests.eq((select y ->> 'today_status' from jsonb_array_elements(public.get_dashboard(:'alice_org') -> 'yachts') y
                  where y ->> 'name' = 'Azura'), 'paid', 'Azura shows PAID today');
select tests.eq((select y ->> 'today_status' from jsonb_array_elements(public.get_dashboard(:'alice_org') -> 'yachts') y
                  where y ->> 'name' = 'Kanaya'), 'available', 'Kanaya available today');
select tests.eq((public.get_dashboard(:'alice_org') -> 'stats' ->> 'outstanding_amount')::numeric > 0, true, 'outstanding payments computed');
reset role;
