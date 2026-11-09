import { supabase, unwrap } from '@/lib/supabase';
import type { Booking, BookingActivity, BookingStatus, Dashboard, Payment } from '@/types/models';

const LIST_SELECT = '*, yacht:yachts(id, name, capacity)';
const DETAIL_SELECT =
  '*, yacht:yachts(id, name, capacity), creator:profiles!bookings_created_by_fkey(full_name, email), updater:profiles!bookings_updated_by_fkey(full_name, email)';

export async function fetchDashboard(orgId: string): Promise<Dashboard> {
  return unwrap(await supabase.rpc('get_dashboard', { p_org: orgId })) as Dashboard;
}

/** Bookings overlapping [fromIso, toIso). */
export async function fetchBookingsInRange(
  orgId: string,
  fromIso: string,
  toIso: string,
  opts: { yachtId?: string | null; statuses?: BookingStatus[] } = {},
): Promise<Booking[]> {
  let q = supabase
    .from('bookings')
    .select(LIST_SELECT)
    .eq('org_id', orgId)
    .lt('starts_at', toIso)
    .gt('ends_at', fromIso)
    .order('starts_at');
  if (opts.yachtId) q = q.eq('yacht_id', opts.yachtId);
  if (opts.statuses?.length) q = q.in('status', opts.statuses);
  return unwrap(await q) as Booking[];
}

export type BookingListFilter = 'upcoming' | 'pending' | 'unpaid' | 'past' | 'cancelled';

export async function fetchBookingList(orgId: string, filter: BookingListFilter, search: string): Promise<Booking[]> {
  const now = new Date().toISOString();
  let q = supabase.from('bookings').select(LIST_SELECT).eq('org_id', orgId).limit(200);
  switch (filter) {
    case 'upcoming':
      q = q.gte('ends_at', now).in('status', ['option', 'hold', 'down_payment', 'paid']).order('starts_at');
      break;
    case 'pending':
      q = q.in('status', ['option', 'hold']).order('expires_at');
      break;
    case 'unpaid':
      q = q.in('status', ['hold', 'down_payment']).gt('balance_due', 0).order('starts_at');
      break;
    case 'past':
      q = q.lt('ends_at', now).in('status', ['down_payment', 'paid']).order('starts_at', { ascending: false });
      break;
    case 'cancelled':
      q = q.in('status', ['cancelled', 'expired']).order('updated_at', { ascending: false });
      break;
  }
  const term = search.trim().replace(/[%,()]/g, '');
  if (term) q = q.or(`customer_name.ilike.%${term}%,ref.ilike.%${term}%,customer_phone.ilike.%${term}%`);
  return unwrap(await q) as Booking[];
}

export async function fetchYachtUpcoming(yachtId: string): Promise<Booking[]> {
  return unwrap(
    await supabase
      .from('bookings')
      .select(LIST_SELECT)
      .eq('yacht_id', yachtId)
      .gte('ends_at', new Date().toISOString())
      .in('status', ['option', 'hold', 'down_payment', 'paid', 'blocked'])
      .order('starts_at')
      .limit(20),
  ) as Booking[];
}

export async function fetchBooking(id: string): Promise<Booking> {
  return unwrap(await supabase.from('bookings').select(DETAIL_SELECT).eq('id', id).single()) as Booking;
}

export interface BookingInput {
  yacht_id: string;
  status: BookingStatus;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  starts_at: string;
  ends_at: string;
  pickup_location?: string | null;
  destination?: string | null;
  passengers?: number | null;
  total_price?: number;
  deposit_amount?: number;
  expires_at?: string | null;
  notes?: string | null;
  block_reason?: string | null;
  payment_reference?: string | null;
}

export interface PaymentInput {
  amount: number;
  kind?: 'payment' | 'refund';
  method?: string;
  paid_at?: string;
  reference?: string | null;
  notes?: string | null;
}

/** Atomic: booking + optional initial payment (server RPC; RLS + conflict rules apply). */
export async function createBooking(input: BookingInput, payment?: PaymentInput | null): Promise<Booking> {
  return unwrap(await supabase.rpc('create_booking', { p_booking: input, p_payment: payment ?? null })) as Booking;
}

export async function updateBooking(id: string, patch: Partial<BookingInput> & { cancel_reason?: string | null }) {
  return unwrap(await supabase.from('bookings').update(patch).eq('id', id).select().single()) as Booking;
}

export async function deleteBooking(id: string) {
  unwrap(await supabase.from('bookings').delete().eq('id', id));
}

export async function fetchPayments(bookingId: string): Promise<Payment[]> {
  return unwrap(
    await supabase
      .from('payments')
      .select('*, recorder:profiles!payments_recorded_by_fkey(full_name, email)')
      .eq('booking_id', bookingId)
      .order('paid_at'),
  ) as Payment[];
}

export async function recordPayment(bookingId: string, input: PaymentInput) {
  return unwrap(
    await supabase.from('payments').insert({ booking_id: bookingId, ...input }).select().single(),
  ) as Payment;
}

export async function fetchActivity(bookingId: string): Promise<BookingActivity[]> {
  return unwrap(
    await supabase
      .from('booking_activity')
      .select('*, actor:profiles!booking_activity_actor_id_fkey(full_name, email)')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false }),
  ) as BookingActivity[];
}
