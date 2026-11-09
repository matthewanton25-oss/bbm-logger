-- =============================================================================
-- YachtOps — core schema
-- Multi-tenant yacht availability & booking management.
--
-- Tenancy model : organizations (a yacht owner / fleet operator / charter company)
-- Access model  : organization_members with role owner | manager | viewer
-- Enforcement   : Postgres Row Level Security + BEFORE/AFTER triggers.
--                 The mobile client is never trusted for validation.
-- =============================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.member_role    as enum ('owner', 'manager', 'viewer');
create type public.account_type   as enum ('yacht_owner', 'fleet_manager');
create type public.yacht_status   as enum ('active', 'inactive', 'archived');
-- AVAILABLE is not stored: a yacht is available when no active booking covers the period.
create type public.booking_status as enum (
  'option',        -- yellow  : temporary interest, expires
  'hold',          -- orange  : reserved, blocks, expires
  'down_payment',  -- blue    : deposit received, confirmed
  'paid',          -- purple  : fully paid
  'blocked',       -- grey    : owner block (maintenance / private use)
  'cancelled',     -- history
  'expired'        -- history : option/hold released automatically
);
create type public.payment_kind       as enum ('payment', 'refund');
create type public.invitation_status  as enum ('pending', 'accepted', 'revoked');

-- -----------------------------------------------------------------------------
-- Organizations & membership
-- -----------------------------------------------------------------------------
create table public.organizations (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null check (length(trim(name)) > 0),
  timezone                 text not null default 'Asia/Jakarta',
  currency                 text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  allow_multiple_options   boolean not null default false,
  option_default_hours     int not null default 24  check (option_default_hours between 1 and 720),
  hold_default_hours       int not null default 72  check (hold_default_hours between 1 and 720),
  expiry_warning_minutes   int not null default 120 check (expiry_warning_minutes between 5 and 2880),
  created_by               uuid references auth.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           citext,
  full_name       text,
  phone           text,
  company_name    text,
  avatar_url      text,
  account_type    public.account_type not null default 'yacht_owner',
  default_org_id  uuid references public.organizations(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       citext not null,
  role        public.member_role not null default 'viewer',
  status      public.invitation_status not null default 'pending',
  invited_by  uuid references auth.users(id) on delete set null,
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index invitations_one_pending_idx
  on public.invitations(org_id, email) where status = 'pending';

-- -----------------------------------------------------------------------------
-- Yachts
-- -----------------------------------------------------------------------------
create table public.yachts (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  name                 text not null check (length(trim(name)) > 0),
  yacht_type           text not null default 'Motor Yacht',
  length_m             numeric(6,2) check (length_m is null or length_m > 0),
  capacity             int not null check (capacity > 0),
  home_marina          text,
  description          text,
  registration_number  text,
  status               public.yacht_status not null default 'active',
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index yachts_org_idx on public.yachts(org_id);

create table public.yacht_photos (
  id            uuid primary key default gen_random_uuid(),
  yacht_id      uuid not null references public.yachts(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  url           text not null,
  storage_path  text,            -- null for externally hosted images
  position      int not null default 0,
  created_at    timestamptz not null default now()
);
create index yacht_photos_yacht_idx on public.yacht_photos(yacht_id, position);

-- -----------------------------------------------------------------------------
-- Bookings
-- -----------------------------------------------------------------------------
create table public.bookings (
  id                        uuid primary key default gen_random_uuid(),
  ref                       text not null unique,
  org_id                    uuid not null references public.organizations(id) on delete cascade,
  yacht_id                  uuid not null references public.yachts(id) on delete restrict,
  status                    public.booking_status not null default 'option',

  customer_name             text,
  customer_phone            text,
  customer_email            citext,

  starts_at                 timestamptz not null,
  ends_at                   timestamptz not null,
  period                    tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  pickup_location           text,
  destination               text,
  passengers                int check (passengers is null or passengers > 0),

  currency                  text not null default 'IDR',
  total_price               numeric(14,2) not null default 0 check (total_price >= 0),
  deposit_amount            numeric(14,2) not null default 0 check (deposit_amount >= 0),
  amount_paid               numeric(14,2) not null default 0,     -- maintained from payments ledger
  balance_due               numeric(14,2) generated always as (greatest(total_price - amount_paid, 0)) stored,
  payment_reference         text,

  expires_at                timestamptz,                          -- option / hold only
  notes                     text,
  block_reason              text,                                 -- blocked only
  cancel_reason             text,
  cancelled_at              timestamptz,

  expiry_warned_at          timestamptz,
  reminder_sent_at          timestamptz,
  balance_reminder_sent_at  timestamptz,

  created_by                uuid references public.profiles(id) on delete set null,
  updated_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint bookings_time_order check (ends_at > starts_at),
  constraint bookings_customer_required check (status = 'blocked' or length(trim(coalesce(customer_name, ''))) > 0),
  constraint bookings_expiry_required check (status not in ('option', 'hold') or expires_at is not null),

  -- The race-proof guarantee: no two confirming/blocking bookings may overlap on one yacht.
  constraint bookings_no_overlap exclude using gist (
    yacht_id with =,
    period   with &&
  ) where (status in ('hold', 'down_payment', 'paid', 'blocked'))
);
create index bookings_org_period_idx   on public.bookings using gist (org_id, period);
create index bookings_yacht_period_idx on public.bookings using gist (yacht_id, period);
create index bookings_expiry_idx       on public.bookings(expires_at) where status in ('option', 'hold');
create index bookings_starts_idx       on public.bookings(org_id, starts_at);

-- Payment ledger: append-only. Corrections are recorded as refunds, never edits.
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  kind         public.payment_kind not null default 'payment',
  amount       numeric(14,2) not null check (amount > 0),
  method       text not null default 'bank_transfer',
  paid_at      timestamptz not null default now(),
  reference    text,
  notes        text,
  recorded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index payments_booking_idx on public.payments(booking_id, paid_at);

-- Audit log for every booking change.
create table public.booking_activity (
  id           bigint generated always as identity primary key,
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,  -- null = system
  action       text not null,
  from_status  public.booking_status,
  to_status    public.booking_status,
  changes      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index booking_activity_booking_idx on public.booking_activity(booking_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table public.notification_preferences (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  push_enabled         boolean not null default true,
  new_booking          boolean not null default true,
  status_changed       boolean not null default true,
  option_expiring      boolean not null default true,
  hold_expiring        boolean not null default true,
  deposit_received     boolean not null default true,
  outstanding_balance  boolean not null default true,
  upcoming_charter     boolean not null default true,
  booking_cancelled    boolean not null default true,
  updated_at           timestamptz not null default now()
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references public.organizations(id) on delete cascade,
  booking_id  uuid references public.bookings(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  pushed_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx   on public.notifications(user_id, created_at desc);
create index notifications_unpushed_idx on public.notifications(created_at) where pushed_at is null;

create table public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text,
  updated_at  timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens(user_id);

-- =============================================================================
-- Access helpers (SECURITY DEFINER to avoid RLS recursion on membership)
-- =============================================================================
create or replace function public.org_role(p_org uuid)
returns public.member_role language sql stable security definer set search_path = public as $$
  select role from public.organization_members where org_id = p_org and user_id = auth.uid()
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where org_id = p_org and user_id = auth.uid())
$$;

create or replace function public.has_org_role(p_org uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = any(p_roles) from public.organization_members
                   where org_id = p_org and user_id = auth.uid()), false)
$$;

create or replace function public.shares_org_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members a
    join public.organization_members b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = p_user)
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger yachts_touch before update on public.yachts
  for each row execute function public.touch_updated_at();

-- Timezone must be a real IANA zone, otherwise all day-boundary math breaks.
create or replace function public.organizations_validate()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;
create trigger organizations_validate before insert or update of timezone on public.organizations
  for each row execute function public.organizations_validate();

-- Never leave an organization without an owner.
create or replace function public.members_keep_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (select 1 from public.organization_members
                   where org_id = old.org_id and role = 'owner' and user_id <> old.user_id)
       and exists (select 1 from public.organizations where id = old.org_id) then
      raise exception 'An organization must keep at least one owner' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger members_keep_owner before update or delete on public.organization_members
  for each row execute function public.members_keep_owner();

-- Photo rows inherit tenant from their yacht.
create or replace function public.yacht_photos_set_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select org_id into new.org_id from public.yachts where id = new.yacht_id;
  return new;
end $$;
create trigger yacht_photos_set_org before insert or update on public.yacht_photos
  for each row execute function public.yacht_photos_set_org();

-- =============================================================================
-- Signup: profile + preferences + personal organization
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_org     uuid;
  v_name    text := nullif(trim(v_meta->>'full_name'), '');
  v_company text := nullif(trim(v_meta->>'company_name'), '');
  v_type    public.account_type := coalesce(nullif(v_meta->>'account_type', '')::public.account_type, 'yacht_owner');
begin
  insert into public.profiles (id, email, full_name, phone, company_name, account_type)
  values (new.id, new.email, v_name, nullif(trim(v_meta->>'phone'), ''), v_company, v_type);

  insert into public.notification_preferences (user_id) values (new.id);

  -- Invited team members join their inviter's organization (after verifying email);
  -- everyone else gets their own private workspace.
  if not exists (select 1 from public.invitations
                 where email = new.email and status = 'pending' and expires_at > now()) then
    insert into public.organizations (name, created_by)
    values (coalesce(v_company, coalesce(v_name, split_part(new.email, '@', 1)) || '''s Fleet'), new.id)
    returning id into v_org;

    insert into public.organization_members (org_id, user_id, role) values (v_org, new.id, 'owner');
    update public.profiles set default_org_id = v_org where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email in sync when a user changes it.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- =============================================================================
-- Booking rules (server-side, authoritative)
-- =============================================================================
create or replace function public.generate_booking_ref()
returns text language plpgsql as $$
declare v_ref text;
begin
  loop
    v_ref := 'YB-' || to_char(now(), 'YYMM') || '-' ||
             upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 5));
    exit when not exists (select 1 from public.bookings where ref = v_ref);
  end loop;
  return v_ref;
end $$;

create or replace function public.booking_status_label(s public.booking_status)
returns text language sql immutable as $$
  select case s
    when 'option' then 'Option' when 'hold' then 'Hold'
    when 'down_payment' then 'Down Payment' when 'paid' then 'Paid'
    when 'blocked' then 'Blocked' when 'cancelled' then 'Cancelled'
    when 'expired' then 'Expired' end
$$;

create or replace function public.bookings_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_yacht     public.yachts;
  v_org       public.organizations;
  v_conflict  public.bookings;
  v_changed   boolean;
  v_range     tstzrange;
begin
  if new.ends_at <= new.starts_at then
    raise exception 'End time must be after start time' using errcode = '23514';
  end if;
  select * into v_yacht from public.yachts where id = new.yacht_id;
  if not found then
    raise exception 'Yacht not found' using errcode = 'P0002';
  end if;
  -- Tenant is always derived from the yacht; RLS WITH CHECK then verifies the caller's role in it.
  new.org_id := v_yacht.org_id;
  select * into v_org from public.organizations where id = new.org_id;

  -- Serialize writes per yacht so the friendly checks below are race-free.
  perform pg_advisory_xact_lock(hashtextextended(new.yacht_id::text, 0));

  if tg_op = 'INSERT' then
    new.ref         := coalesce(nullif(new.ref, ''), public.generate_booking_ref());
    new.created_by  := coalesce(v_uid, new.created_by);
    new.created_at  := now();
    new.amount_paid := 0;
    new.currency    := v_org.currency;
    if v_yacht.status <> 'active' then
      raise exception '% is % and cannot take new bookings', v_yacht.name, v_yacht.status using errcode = '22023';
    end if;
    v_changed := true;
  else
    new.ref        := old.ref;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- amount_paid is owned by the payments ledger.
    if new.amount_paid is distinct from old.amount_paid
       and coalesce(current_setting('app.payment_sync', true), '') <> 'on' then
      new.amount_paid := old.amount_paid;
    end if;
    v_changed := new.status <> old.status or new.starts_at <> old.starts_at
              or new.ends_at <> old.ends_at or new.yacht_id <> old.yacht_id;
  end if;

  if v_uid is not null then new.updated_by := v_uid; end if;
  new.updated_at := now();

  -- Only owners may block dates.
  if new.status = 'blocked' and v_uid is not null
     and (tg_op = 'INSERT' or old.status <> 'blocked')
     and not public.has_org_role(new.org_id, array['owner']::public.member_role[]) then
    raise exception 'Only owners can block dates' using errcode = '42501';
  end if;

  -- Passenger capacity.
  if new.passengers is not null and new.passengers > v_yacht.capacity
     and (tg_op = 'INSERT' or new.passengers is distinct from old.passengers or new.yacht_id <> old.yacht_id) then
    raise exception '% carries at most % passengers', v_yacht.name, v_yacht.capacity using errcode = '23514';
  end if;

  -- Expiry handling for option/hold.
  if new.status in ('option', 'hold') then
    if new.expires_at is null
       or (tg_op = 'UPDATE' and new.status <> old.status and new.expires_at is not distinct from old.expires_at) then
      new.expires_at := now() + make_interval(hours =>
        case when new.status = 'option' then v_org.option_default_hours else v_org.hold_default_hours end);
    end if;
    if new.expires_at <= now()
       and (tg_op = 'INSERT' or new.status <> old.status or new.expires_at is distinct from old.expires_at) then
      raise exception 'Expiration time must be in the future' using errcode = '22023';
    end if;
    if tg_op = 'INSERT' or new.status <> old.status or new.expires_at is distinct from old.expires_at then
      new.expiry_warned_at := null;
    end if;
  elsif new.status <> 'expired' then
    new.expires_at := null;
  end if;

  -- Cancellation bookkeeping.
  if new.status = 'cancelled' then
    if tg_op = 'INSERT' or old.status <> 'cancelled' then new.cancelled_at := now(); end if;
  else
    new.cancelled_at := null;
    new.cancel_reason := null;
  end if;
  if new.status <> 'blocked' then new.block_reason := null; end if;

  -- Reschedules re-arm reminders.
  if tg_op = 'UPDATE' and (new.starts_at <> old.starts_at) then
    new.reminder_sent_at := null;
    new.balance_reminder_sent_at := null;
  end if;

  -- Conflict validation (human-readable; the exclusion constraint is the final guarantee).
  if v_changed then
    v_range := tstzrange(new.starts_at, new.ends_at, '[)');

    if new.status in ('option', 'hold', 'down_payment', 'paid', 'blocked') then
      select * into v_conflict from public.bookings b
       where b.yacht_id = new.yacht_id and b.id <> new.id
         and b.status in ('hold', 'down_payment', 'paid', 'blocked')
         and b.period && v_range
       order by b.starts_at limit 1;
      if found then
        raise exception '% is already on % (%) during this period',
          v_yacht.name, public.booking_status_label(v_conflict.status), v_conflict.ref
          using errcode = '23P01', detail = v_conflict.id::text;
      end if;
    end if;

    if new.status = 'option' and not v_org.allow_multiple_options then
      select * into v_conflict from public.bookings b
       where b.yacht_id = new.yacht_id and b.id <> new.id
         and b.status = 'option' and b.period && v_range
       order by b.starts_at limit 1;
      if found then
        raise exception '% already has an option (%) for this period. Enable multiple options in settings to allow more.',
          v_yacht.name, v_conflict.ref using errcode = '23P01', detail = v_conflict.id::text;
      end if;
    end if;
  end if;

  return new;
end $$;

create trigger bookings_before_write before insert or update on public.bookings
  for each row execute function public.bookings_before_write();

-- -----------------------------------------------------------------------------
-- Notification fan-out
-- -----------------------------------------------------------------------------
create or replace function public.notify_org(
  p_org uuid, p_type text, p_title text, p_body text,
  p_booking uuid default null, p_data jsonb default '{}'::jsonb, p_roles public.member_role[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into public.notifications (user_id, org_id, booking_id, type, title, body, data)
  select m.user_id, p_org, p_booking, p_type, p_title, p_body, p_data
    from public.organization_members m
    left join public.notification_preferences np on np.user_id = m.user_id
   where m.org_id = p_org
     and m.user_id is distinct from auth.uid()            -- don't notify the actor
     and (p_roles is null or m.role = any(p_roles))
     and coalesce((to_jsonb(np) ->> p_type)::boolean, true);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- Audit log + event notifications
-- -----------------------------------------------------------------------------
create or replace function public.bookings_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_changes  jsonb;
  v_action   text;
  v_yacht    text;
  v_type     text;
  v_title    text;
  v_when     text;
  v_tz       text;
  v_sync     boolean := coalesce(current_setting('app.payment_sync', true), '') = 'on';
begin
  select y.name, o.timezone into v_yacht, v_tz
    from public.yachts y join public.organizations o on o.id = y.org_id where y.id = new.yacht_id;
  v_when := to_char(new.starts_at at time zone v_tz, 'Dy DD Mon HH24:MI');

  if tg_op = 'INSERT' then
    insert into public.booking_activity (booking_id, org_id, actor_id, action, to_status, changes)
    values (new.id, new.org_id, auth.uid(), 'created', new.status,
            jsonb_build_object('starts_at', new.starts_at, 'ends_at', new.ends_at,
                               'customer_name', new.customer_name, 'total_price', new.total_price));
    if new.status <> 'blocked' then
      perform public.notify_org(new.org_id, 'new_booking',
        'New ' || public.booking_status_label(new.status) || ' · ' || v_yacht,
        coalesce(new.customer_name, '') || ' · ' || v_when, new.id,
        jsonb_build_object('booking_id', new.id, 'status', new.status));
    end if;
    return new;
  end if;

  select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value)), '{}'::jsonb)
    into v_changes
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
   where n.value is distinct from o.value
     and n.key not in ('updated_at', 'updated_by', 'period', 'balance_due',
                       'expiry_warned_at', 'reminder_sent_at', 'balance_reminder_sent_at');

  if v_changes = '{}'::jsonb then return new; end if;
  -- Ledger syncs are logged by the payment itself unless they moved the status.
  if v_sync and new.status = old.status then return new; end if;

  v_action := case
    when new.status = old.status then 'updated'
    when new.status = 'cancelled' then 'cancelled'
    when new.status = 'expired' then 'expired'
    else 'status_changed' end;

  insert into public.booking_activity (booking_id, org_id, actor_id, action, from_status, to_status, changes)
  values (new.id, new.org_id, auth.uid(), v_action,
          case when new.status <> old.status then old.status end,
          case when new.status <> old.status then new.status end,
          v_changes);

  if new.status <> old.status then
    v_type := case new.status
      when 'cancelled' then 'booking_cancelled'
      when 'down_payment' then 'deposit_received'
      else 'status_changed' end;
    v_title := case new.status
      when 'cancelled' then 'Booking cancelled · ' || v_yacht
      when 'expired' then public.booking_status_label(old.status) || ' expired · ' || v_yacht || ' is available again'
      when 'down_payment' then 'Deposit received · ' || v_yacht
      when 'paid' then 'Fully paid · ' || v_yacht
      else v_yacht || ': ' || public.booking_status_label(old.status) || ' → ' || public.booking_status_label(new.status) end;
    perform public.notify_org(new.org_id, v_type, v_title,
      coalesce(new.customer_name, '') || ' · ' || v_when || ' · ' || new.ref, new.id,
      jsonb_build_object('booking_id', new.id, 'status', new.status, 'from', old.status));
  end if;
  return new;
end $$;

create trigger bookings_after_write after insert or update on public.bookings
  for each row execute function public.bookings_after_write();

-- -----------------------------------------------------------------------------
-- Payments ledger → booking totals and automatic status progression
--   deposit recorded  → DOWN PAYMENT
--   balance cleared   → PAID
-- -----------------------------------------------------------------------------
create or replace function public.payments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = new.booking_id;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  new.org_id := v_booking.org_id;
  new.recorded_by := coalesce(auth.uid(), new.recorded_by);
  new.created_at := now();
  if new.kind = 'payment' and v_booking.status in ('cancelled', 'expired', 'blocked') then
    raise exception 'Cannot record a payment on a % booking', public.booking_status_label(v_booking.status)
      using errcode = '22023';
  end if;
  if new.kind = 'refund' and new.amount > v_booking.amount_paid then
    raise exception 'Refund exceeds amount paid' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger payments_before_insert before insert on public.payments
  for each row execute function public.payments_before_insert();

create or replace function public.payments_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_paid   numeric(14,2);
  v_b      public.bookings;
  v_status public.booking_status;
begin
  select coalesce(sum(case when kind = 'refund' then -amount else amount end), 0)
    into v_paid from public.payments where booking_id = new.booking_id;
  select * into v_b from public.bookings where id = new.booking_id;

  v_status := case
    when v_b.status in ('option', 'hold', 'down_payment') and v_b.total_price > 0 and v_paid >= v_b.total_price then 'paid'
    when v_b.status in ('option', 'hold') and v_paid > 0 then 'down_payment'
    when v_b.status = 'paid' and v_b.total_price > 0 and v_paid < v_b.total_price and v_paid > 0 then 'down_payment'
    else v_b.status end;

  perform set_config('app.payment_sync', 'on', true);
  update public.bookings
     set amount_paid = v_paid,
         status = v_status,
         payment_reference = coalesce(new.reference, payment_reference)
   where id = new.booking_id;
  perform set_config('app.payment_sync', 'off', true);

  insert into public.booking_activity (booking_id, org_id, actor_id, action, changes)
  values (new.booking_id, new.org_id, auth.uid(),
          case when new.kind = 'refund' then 'refund_recorded' else 'payment_recorded' end,
          jsonb_build_object('payment_id', new.id, 'amount', new.amount, 'method', new.method,
                             'reference', new.reference, 'paid_at', new.paid_at, 'amount_paid', v_paid));
  return new;
end $$;
create trigger payments_after_insert after insert on public.payments
  for each row execute function public.payments_after_insert();

-- Totals changed after payments exist → re-evaluate PAID.
create or replace function public.bookings_reconcile_paid()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.total_price <> old.total_price and new.status in ('down_payment', 'paid') and new.amount_paid > 0 then
    if new.amount_paid >= new.total_price and new.status = 'down_payment' then
      update public.bookings set status = 'paid' where id = new.id;
    elsif new.amount_paid < new.total_price and new.status = 'paid' then
      update public.bookings set status = 'down_payment' where id = new.id;
    end if;
  end if;
  return null;
end $$;
create trigger bookings_reconcile_paid after update of total_price on public.bookings
  for each row execute function public.bookings_reconcile_paid();

-- =============================================================================
-- Scheduled maintenance: expiry, warnings, reminders (run every few minutes)
-- =============================================================================
create or replace function public.run_booking_maintenance()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_expired  int;
  v_warned   int := 0;
  v_reminded int := 0;
  v_balance  int := 0;
  r record;
begin
  -- 1) Release expired options/holds → slot becomes AVAILABLE.
  update public.bookings set status = 'expired'
   where status in ('option', 'hold') and expires_at <= now();
  get diagnostics v_expired = row_count;

  -- 2) Warn before expiry.
  for r in
    select b.*, y.name as yacht_name, o.timezone
      from public.bookings b
      join public.yachts y on y.id = b.yacht_id
      join public.organizations o on o.id = b.org_id
     where b.status in ('option', 'hold') and b.expiry_warned_at is null
       and b.expires_at <= now() + make_interval(mins => o.expiry_warning_minutes)
  loop
    perform public.notify_org(r.org_id,
      case when r.status = 'option' then 'option_expiring' else 'hold_expiring' end,
      public.booking_status_label(r.status) || ' expiring · ' || r.yacht_name,
      r.customer_name || ' · expires ' || to_char(r.expires_at at time zone r.timezone, 'Dy DD Mon HH24:MI') || ' · ' || r.ref,
      r.id, jsonb_build_object('booking_id', r.id, 'status', r.status),
      array['owner', 'manager']::public.member_role[]);
    update public.bookings set expiry_warned_at = now() where id = r.id;
    v_warned := v_warned + 1;
  end loop;

  -- 3) Upcoming charter within 24h.
  for r in
    select b.*, y.name as yacht_name, o.timezone
      from public.bookings b
      join public.yachts y on y.id = b.yacht_id
      join public.organizations o on o.id = b.org_id
     where b.status in ('hold', 'down_payment', 'paid') and b.reminder_sent_at is null
       and b.starts_at > now() and b.starts_at <= now() + interval '24 hours'
  loop
    perform public.notify_org(r.org_id, 'upcoming_charter',
      'Charter tomorrow · ' || r.yacht_name,
      r.customer_name || ' · ' || to_char(r.starts_at at time zone r.timezone, 'Dy DD Mon HH24:MI')
        || coalesce(' · ' || r.pickup_location, ''),
      r.id, jsonb_build_object('booking_id', r.id, 'status', r.status));
    update public.bookings set reminder_sent_at = now() where id = r.id;
    v_reminded := v_reminded + 1;
  end loop;

  -- 4) Outstanding balance within 3 days of departure.
  for r in
    select b.*, y.name as yacht_name
      from public.bookings b
      join public.yachts y on y.id = b.yacht_id
     where b.status in ('hold', 'down_payment') and b.balance_due > 0 and b.balance_reminder_sent_at is null
       and b.starts_at > now() and b.starts_at <= now() + interval '3 days'
  loop
    perform public.notify_org(r.org_id, 'outstanding_balance',
      'Outstanding balance · ' || r.yacht_name,
      r.customer_name || ' owes ' || r.currency || ' ' || to_char(r.balance_due, 'FM999,999,999,990') || ' · ' || r.ref,
      r.id, jsonb_build_object('booking_id', r.id, 'balance_due', r.balance_due),
      array['owner']::public.member_role[]);
    update public.bookings set balance_reminder_sent_at = now() where id = r.id;
    v_balance := v_balance + 1;
  end loop;

  return jsonb_build_object('expired', v_expired, 'expiry_warnings', v_warned,
                            'charter_reminders', v_reminded, 'balance_reminders', v_balance);
end $$;

-- =============================================================================
-- RPCs used by the app
-- =============================================================================

-- Dashboard: KPIs + "Today's Yacht Availability", computed in the org's timezone.
create or replace function public.get_dashboard(p_org uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_tz     text;
  v_start  timestamptz;
  v_end    timestamptz;
  v_today  tstzrange;
  v_yachts jsonb;
  v_stats  jsonb;
  v_upcoming jsonb;
begin
  if not public.is_org_member(p_org) then
    raise exception 'Not a member of this organization' using errcode = '42501';
  end if;
  select timezone into v_tz from public.organizations where id = p_org;
  v_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  v_end   := v_start + interval '1 day';
  v_today := tstzrange(v_start, v_end, '[)');

  with y as (
    select y.*,
      (select p.url from public.yacht_photos p where p.yacht_id = y.id order by p.position, p.created_at limit 1) as cover_url,
      (select to_jsonb(t) from (
          select b.id, b.status, b.starts_at, b.ends_at, b.customer_name, b.ref
            from public.bookings b
           where b.yacht_id = y.id and b.period && v_today
             and b.status in ('option', 'hold', 'down_payment', 'paid', 'blocked')
           order by array_position(array['blocked','paid','down_payment','hold','option']::public.booking_status[], b.status),
                    b.starts_at
           limit 1) t) as today_booking,
      (select to_jsonb(t) from (
          select b.id, b.status, b.starts_at, b.ends_at, b.customer_name, b.ref
            from public.bookings b
           where b.yacht_id = y.id and b.starts_at >= v_end
             and b.status in ('option', 'hold', 'down_payment', 'paid', 'blocked')
           order by b.starts_at limit 1) t) as next_booking
    from public.yachts y
    where y.org_id = p_org and y.status = 'active'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'name', name, 'yacht_type', yacht_type, 'capacity', capacity,
           'home_marina', home_marina, 'cover_url', cover_url,
           'today_status', coalesce(today_booking->>'status', 'available'),
           'today_booking', today_booking, 'next_booking', next_booking) order by name), '[]'::jsonb),
         jsonb_build_object(
           'total_yachts', count(*),
           'available_today', count(*) filter (where today_booking is null),
           'on_option_today', count(*) filter (where today_booking->>'status' = 'option'),
           'on_hold_today', count(*) filter (where today_booking->>'status' = 'hold'))
    into v_yachts, v_stats
    from y;

  v_stats := v_stats || (
    select jsonb_build_object(
      'confirmed_bookings', count(*) filter (where status in ('down_payment', 'paid')),
      'deposit_bookings', count(*) filter (where status = 'down_payment'),
      'paid_bookings', count(*) filter (where status = 'paid'),
      'active_options', count(*) filter (where status = 'option'),
      'active_holds', count(*) filter (where status = 'hold'),
      'upcoming_charters_7d', count(*) filter (where status in ('hold', 'down_payment', 'paid')
                                                and starts_at >= now() and starts_at < now() + interval '7 days'),
      'outstanding_amount', coalesce(sum(balance_due) filter (where status in ('hold', 'down_payment')), 0),
      'outstanding_count', count(*) filter (where status in ('hold', 'down_payment') and balance_due > 0))
    from public.bookings
    where org_id = p_org and ends_at >= now());

  select coalesce(jsonb_agg(t order by t.starts_at), '[]'::jsonb) into v_upcoming from (
    select b.id, b.ref, b.status, b.starts_at, b.ends_at, b.customer_name, b.passengers,
           b.balance_due, b.yacht_id, y.name as yacht_name
      from public.bookings b join public.yachts y on y.id = b.yacht_id
     where b.org_id = p_org and b.starts_at >= now()
       and b.status in ('option', 'hold', 'down_payment', 'paid')
     order by b.starts_at limit 8) t;

  return jsonb_build_object('timezone', v_tz, 'day_start', v_start, 'stats', v_stats,
                            'yachts', v_yachts, 'upcoming', v_upcoming);
end $$;

-- Team: invite (owner only). Email delivery handled by the invite-member edge function.
create or replace function public.invite_member(p_org uuid, p_email text, p_role public.member_role)
returns public.invitations language plpgsql security definer set search_path = public as $$
declare v_inv public.invitations;
begin
  if not public.has_org_role(p_org, array['owner']::public.member_role[]) then
    raise exception 'Only owners can invite team members' using errcode = '42501';
  end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;
  if exists (select 1 from public.organization_members m join public.profiles p on p.id = m.user_id
             where m.org_id = p_org and p.email = p_email::citext) then
    raise exception 'This person is already a member' using errcode = '23505';
  end if;
  update public.invitations set status = 'revoked'
   where org_id = p_org and email = p_email::citext and status = 'pending';
  insert into public.invitations (org_id, email, role, invited_by)
  values (p_org, lower(trim(p_email)), p_role, auth.uid())
  returning * into v_inv;
  return v_inv;
end $$;

-- Team: accept invitations addressed to the caller's verified email.
create or replace function public.accept_pending_invitations()
returns int language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_email citext;
  v_count int := 0;
  r record;
begin
  select email into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then return 0; end if;

  for r in select * from public.invitations
            where email = v_email and status = 'pending' and expires_at > now()
  loop
    insert into public.organization_members (org_id, user_id, role)
    values (r.org_id, v_uid, r.role) on conflict (org_id, user_id) do nothing;
    update public.invitations set status = 'accepted', accepted_at = now() where id = r.id;
    update public.profiles set default_org_id = coalesce(default_org_id, r.org_id) where id = v_uid;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Atomic create: booking + optional initial payment (deposit / full payment) in one transaction.
-- Runs as the caller (SECURITY INVOKER) so all RLS policies and triggers apply unchanged.
create or replace function public.create_booking(p_booking jsonb, p_payment jsonb default null)
returns public.bookings language plpgsql security invoker set search_path = public as $$
declare v_b public.bookings;
begin
  insert into public.bookings (
    yacht_id, status, customer_name, customer_phone, customer_email, starts_at, ends_at,
    pickup_location, destination, passengers, total_price, deposit_amount, expires_at,
    notes, block_reason, payment_reference)
  values (
    (p_booking->>'yacht_id')::uuid,
    coalesce(p_booking->>'status', 'option')::public.booking_status,
    nullif(trim(p_booking->>'customer_name'), ''),
    nullif(trim(p_booking->>'customer_phone'), ''),
    nullif(trim(p_booking->>'customer_email'), ''),
    (p_booking->>'starts_at')::timestamptz,
    (p_booking->>'ends_at')::timestamptz,
    nullif(trim(p_booking->>'pickup_location'), ''),
    nullif(trim(p_booking->>'destination'), ''),
    nullif(p_booking->>'passengers', '')::int,
    coalesce(nullif(p_booking->>'total_price', '')::numeric, 0),
    coalesce(nullif(p_booking->>'deposit_amount', '')::numeric, 0),
    nullif(p_booking->>'expires_at', '')::timestamptz,
    nullif(trim(p_booking->>'notes'), ''),
    nullif(trim(p_booking->>'block_reason'), ''),
    nullif(trim(p_booking->>'payment_reference'), ''))
  returning * into v_b;

  if p_payment is not null and coalesce(nullif(p_payment->>'amount', '')::numeric, 0) > 0 then
    insert into public.payments (booking_id, amount, method, paid_at, reference, notes)
    values (v_b.id, (p_payment->>'amount')::numeric,
            coalesce(nullif(p_payment->>'method', ''), 'bank_transfer'),
            coalesce(nullif(p_payment->>'paid_at', '')::timestamptz, now()),
            nullif(trim(p_payment->>'reference'), ''), nullif(trim(p_payment->>'notes'), ''));
    select * into v_b from public.bookings where id = v_b.id;
  end if;
  return v_b;
end $$;
grant execute on function public.create_booking(jsonb, jsonb) to authenticated;

-- Create an additional workspace (e.g. a second company).
create or replace function public.create_organization(p_name text, p_timezone text default 'Asia/Jakarta', p_currency text default 'IDR')
returns public.organizations language plpgsql security definer set search_path = public as $$
declare v_org public.organizations;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  insert into public.organizations (name, timezone, currency, created_by)
  values (p_name, p_timezone, p_currency, auth.uid()) returning * into v_org;
  insert into public.organization_members (org_id, user_id, role) values (v_org.id, auth.uid(), 'owner');
  return v_org;
end $$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.organizations            enable row level security;
alter table public.organization_members     enable row level security;
alter table public.profiles                 enable row level security;
alter table public.invitations              enable row level security;
alter table public.yachts                   enable row level security;
alter table public.yacht_photos             enable row level security;
alter table public.bookings                 enable row level security;
alter table public.payments                 enable row level security;
alter table public.booking_activity         enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_tokens              enable row level security;

-- organizations
create policy org_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy org_update on public.organizations for update to authenticated
  using (public.has_org_role(id, array['owner']::public.member_role[]))
  with check (public.has_org_role(id, array['owner']::public.member_role[]));

-- organization_members
create policy members_select on public.organization_members for select to authenticated
  using (public.is_org_member(org_id));
create policy members_update on public.organization_members for update to authenticated
  using (public.has_org_role(org_id, array['owner']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner']::public.member_role[]));
create policy members_delete on public.organization_members for delete to authenticated
  using (public.has_org_role(org_id, array['owner']::public.member_role[]) or user_id = auth.uid());

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and (default_org_id is null or public.is_org_member(default_org_id)));

-- invitations
create policy invitations_select on public.invitations for select to authenticated
  using (public.has_org_role(org_id, array['owner']::public.member_role[])
         or email = (auth.jwt() ->> 'email')::citext);
create policy invitations_update on public.invitations for update to authenticated
  using (public.has_org_role(org_id, array['owner']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner']::public.member_role[]));

-- yachts (owners manage the fleet; everyone in the org can see it)
create policy yachts_select on public.yachts for select to authenticated
  using (public.is_org_member(org_id));
create policy yachts_insert on public.yachts for insert to authenticated
  with check (public.has_org_role(org_id, array['owner']::public.member_role[]));
create policy yachts_update on public.yachts for update to authenticated
  using (public.has_org_role(org_id, array['owner']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner']::public.member_role[]));
create policy yachts_delete on public.yachts for delete to authenticated
  using (public.has_org_role(org_id, array['owner']::public.member_role[]));

create policy yacht_photos_select on public.yacht_photos for select to authenticated
  using (public.is_org_member(org_id));
create policy yacht_photos_insert on public.yacht_photos for insert to authenticated
  with check (public.has_org_role(org_id, array['owner']::public.member_role[]));
create policy yacht_photos_update on public.yacht_photos for update to authenticated
  using (public.has_org_role(org_id, array['owner']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner']::public.member_role[]));
create policy yacht_photos_delete on public.yacht_photos for delete to authenticated
  using (public.has_org_role(org_id, array['owner']::public.member_role[]));

-- bookings (owners + booking managers write; viewers read)
create policy bookings_select on public.bookings for select to authenticated
  using (public.is_org_member(org_id));
create policy bookings_insert on public.bookings for insert to authenticated
  with check (public.has_org_role(org_id, array['owner', 'manager']::public.member_role[]));
create policy bookings_update on public.bookings for update to authenticated
  using (public.has_org_role(org_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_org_role(org_id, array['owner', 'manager']::public.member_role[]));
create policy bookings_delete on public.bookings for delete to authenticated
  using (public.has_org_role(org_id, array['owner']::public.member_role[]));

-- payments (append-only ledger, owners record money)
create policy payments_select on public.payments for select to authenticated
  using (public.is_org_member(org_id));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.has_org_role(org_id, array['owner']::public.member_role[]));

-- activity log (written by triggers only)
create policy activity_select on public.booking_activity for select to authenticated
  using (public.is_org_member(org_id));

-- personal data
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy prefs_all on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_tokens_all on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- Privileges
-- =============================================================================
revoke all on function public.run_booking_maintenance() from public;
revoke all on function public.notify_org(uuid, text, text, text, uuid, jsonb, public.member_role[]) from public;
revoke all on function public.handle_new_user() from public;
grant execute on function public.get_dashboard(uuid) to authenticated;
grant execute on function public.invite_member(uuid, text, public.member_role) to authenticated;
grant execute on function public.accept_pending_invitations() to authenticated;
grant execute on function public.create_organization(text, text, text) to authenticated;

-- Ledger and audit log are immutable for API users.
revoke update, delete on public.payments from authenticated, anon;
revoke insert, update, delete on public.booking_activity from authenticated, anon;
-- Only the payments ledger may change amount_paid (enforced in trigger as well).
