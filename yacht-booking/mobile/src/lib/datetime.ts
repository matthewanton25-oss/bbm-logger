/**
 * Timezone model
 * --------------
 * All instants are stored in Postgres as timestamptz (UTC). Each organization has an IANA
 * timezone (e.g. Asia/Jakarta) — the marina's local time — and every screen shows and edits
 * times in THAT zone, regardless of the phone's timezone. A broker in Singapore and a captain
 * in Jakarta therefore see the same "09:00 departure".
 *
 * "Wall" dates are JS Dates whose local fields (getHours, getDate…) represent the org's wall
 * clock. They are only for display/calendar math; convert back with fromWall() before saving.
 */
import { addDays, startOfDay } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const toWall = (instant: string | Date, tz: string): Date => toZonedTime(instant, tz);
export const fromWall = (wall: Date, tz: string): Date => fromZonedTime(wall, tz);
export const fmtTz = (instant: string | Date, tz: string, pattern: string) =>
  formatInTimeZone(instant, tz, pattern);

export const nowWall = (tz: string) => toWall(new Date(), tz);
export const todayWall = (tz: string) => startOfDay(nowWall(tz));

/** UTC ISO range covering wall-clock [from, to) in tz. */
export function wallRangeToUtc(from: Date, to: Date, tz: string) {
  return { from: fromWall(from, tz).toISOString(), to: fromWall(to, tz).toISOString() };
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export function dayBounds(day: Date) {
  const s = startOfDay(day);
  return { start: s, end: addDays(s, 1) };
}

export function formatRange(startIso: string, endIso: string, tz: string) {
  const sameDay = fmtTz(startIso, tz, 'yyyy-MM-dd') === fmtTz(endIso, tz, 'yyyy-MM-dd');
  return sameDay
    ? `${fmtTz(startIso, tz, 'EEE d MMM')} · ${fmtTz(startIso, tz, 'HH:mm')}–${fmtTz(endIso, tz, 'HH:mm')}`
    : `${fmtTz(startIso, tz, 'EEE d MMM HH:mm')} → ${fmtTz(endIso, tz, 'EEE d MMM HH:mm')}`;
}

export function relativeFromNow(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const txt = mins < 60 ? `${mins}m` : hours < 48 ? `${hours}h` : `${days}d`;
  return diff >= 0 ? `in ${txt}` : `${txt} ago`;
}

export const COMMON_TIMEZONES = [
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Manila',
  'Asia/Hong_Kong',
  'Asia/Dubai',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Paris',
  'Europe/Athens',
  'America/New_York',
  'America/Miami',
  'America/Los_Angeles',
  'UTC',
];
