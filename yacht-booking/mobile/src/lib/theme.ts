import type { BookingStatus, AvailabilityStatus } from '@/types/models';

export const colors = {
  bg: '#FFFFFF',
  surface: '#F4F7FA',
  card: '#FFFFFF',
  navy: '#0B1F3A',
  navySoft: '#1E3557',
  text: '#0B1F3A',
  muted: '#6B7A90',
  faint: '#9AA6B6',
  border: '#E4EAF1',
  accent: '#1EB6E6',
  accentDark: '#0E93BF',
  accentSoft: '#E4F7FD',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  success: '#22A06B',
  white: '#FFFFFF',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = (n: number) => n * 4;

export const font = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.navy, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.navy, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '600' as const, color: colors.navy },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  tiny: { fontSize: 11, color: colors.muted },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};

export const shadow = {
  shadowColor: '#0B1F3A',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

interface StatusMeta {
  label: string;
  short: string;
  color: string; // solid
  soft: string; // background tint
  onColor: string; // text on solid
}

export const STATUS: Record<AvailabilityStatus, StatusMeta> = {
  available: { label: 'Available', short: 'AVL', color: '#22A06B', soft: '#E6F6EE', onColor: '#FFFFFF' },
  option: { label: 'Option', short: 'OPT', color: '#F2C200', soft: '#FFF8D6', onColor: '#3D3100' },
  hold: { label: 'Hold', short: 'HLD', color: '#F5841F', soft: '#FFEEDD', onColor: '#FFFFFF' },
  down_payment: { label: 'Down Payment', short: 'DP', color: '#2F6FED', soft: '#E5EEFE', onColor: '#FFFFFF' },
  paid: { label: 'Paid', short: 'PAID', color: '#7C4DDB', soft: '#F0E9FD', onColor: '#FFFFFF' },
  blocked: { label: 'Blocked', short: 'BLK', color: '#5B6678', soft: '#ECEEF2', onColor: '#FFFFFF' },
  cancelled: { label: 'Cancelled', short: 'CXL', color: '#B4BCC8', soft: '#F3F4F6', onColor: '#FFFFFF' },
  expired: { label: 'Expired', short: 'EXP', color: '#B4BCC8', soft: '#F3F4F6', onColor: '#FFFFFF' },
};

export const ACTIVE_STATUSES: BookingStatus[] = ['option', 'hold', 'down_payment', 'paid', 'blocked'];
export const BLOCKING_STATUSES: BookingStatus[] = ['hold', 'down_payment', 'paid', 'blocked'];
export const CALENDAR_STATUSES: BookingStatus[] = [...ACTIVE_STATUSES, 'cancelled', 'expired'];
