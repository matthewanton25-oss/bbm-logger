export type Role = 'owner' | 'manager' | 'viewer';
export type AccountType = 'yacht_owner' | 'fleet_manager';
export type YachtStatus = 'active' | 'inactive' | 'archived';
export type BookingStatus =
  | 'option'
  | 'hold'
  | 'down_payment'
  | 'paid'
  | 'blocked'
  | 'cancelled'
  | 'expired';
/** Derived state for a yacht/time slot with no active booking. */
export type AvailabilityStatus = BookingStatus | 'available';

export interface Organization {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  allow_multiple_options: boolean;
  option_default_hours: number;
  hold_default_hours: number;
  expiry_warning_minutes: number;
  created_at: string;
}

export interface Membership {
  org_id: string;
  user_id: string;
  role: Role;
  created_at: string;
  organization?: Organization;
  profile?: Profile;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  account_type: AccountType;
  default_org_id: string | null;
}

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  expires_at: string;
  created_at: string;
  organization?: Pick<Organization, 'id' | 'name'>;
}

export interface YachtPhoto {
  id: string;
  yacht_id: string;
  url: string;
  storage_path: string | null;
  position: number;
}

export interface Yacht {
  id: string;
  org_id: string;
  name: string;
  yacht_type: string;
  length_m: number | null;
  capacity: number;
  home_marina: string | null;
  description: string | null;
  registration_number: string | null;
  status: YachtStatus;
  created_at: string;
  photos?: YachtPhoto[];
}

export interface Booking {
  id: string;
  ref: string;
  org_id: string;
  yacht_id: string;
  status: BookingStatus;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  starts_at: string;
  ends_at: string;
  pickup_location: string | null;
  destination: string | null;
  passengers: number | null;
  currency: string;
  total_price: number;
  deposit_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_reference: string | null;
  expires_at: string | null;
  notes: string | null;
  block_reason: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  yacht?: Pick<Yacht, 'id' | 'name' | 'capacity'> | null;
  creator?: Pick<Profile, 'full_name' | 'email'> | null;
  updater?: Pick<Profile, 'full_name' | 'email'> | null;
}

export interface Payment {
  id: string;
  booking_id: string;
  kind: 'payment' | 'refund';
  amount: number;
  method: string;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  recorder?: Pick<Profile, 'full_name' | 'email'> | null;
}

export interface BookingActivity {
  id: number;
  booking_id: string;
  actor_id: string | null;
  action: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus | null;
  changes: Record<string, unknown>;
  created_at: string;
  actor?: Pick<Profile, 'full_name' | 'email'> | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  booking_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  push_enabled: boolean;
  new_booking: boolean;
  status_changed: boolean;
  option_expiring: boolean;
  hold_expiring: boolean;
  deposit_received: boolean;
  outstanding_balance: boolean;
  upcoming_charter: boolean;
  booking_cancelled: boolean;
}

export interface DashboardBookingRef {
  id: string;
  ref: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  customer_name: string | null;
}

export interface DashboardYacht {
  id: string;
  name: string;
  yacht_type: string;
  capacity: number;
  home_marina: string | null;
  cover_url: string | null;
  today_status: AvailabilityStatus;
  today_booking: DashboardBookingRef | null;
  next_booking: DashboardBookingRef | null;
}

export interface Dashboard {
  timezone: string;
  day_start: string;
  stats: {
    total_yachts: number;
    available_today: number;
    on_option_today: number;
    on_hold_today: number;
    confirmed_bookings: number;
    deposit_bookings: number;
    paid_bookings: number;
    active_options: number;
    active_holds: number;
    upcoming_charters_7d: number;
    outstanding_amount: number;
    outstanding_count: number;
  };
  yachts: DashboardYacht[];
  upcoming: (DashboardBookingRef & {
    yacht_id: string;
    yacht_name: string;
    passengers: number | null;
    balance_due: number;
  })[];
}
