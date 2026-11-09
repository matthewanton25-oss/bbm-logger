import type { Booking } from '@/types/models';

/** A booking projected onto the organization's wall clock. */
export interface CalEvent {
  booking: Booking;
  start: Date;
  end: Date;
}
