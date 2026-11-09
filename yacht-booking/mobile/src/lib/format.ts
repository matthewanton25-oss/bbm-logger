const formatters = new Map<string, Intl.NumberFormat>();

export function money(amount: number | string | null | undefined, currency = 'IDR', compact = false) {
  const value = Number(amount ?? 0);
  const key = `${currency}:${compact}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'IDR' || compact ? 0 : 2,
        notation: compact ? 'compact' : 'standard',
      });
    } catch {
      f = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    }
    formatters.set(key, f);
  }
  return f.format(value);
}

export function parseAmount(text: string): number {
  const n = Number(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function displayName(p?: { full_name?: string | null; email?: string | null } | null) {
  return p?.full_name || p?.email || 'System';
}

export const ROLE_LABEL = { owner: 'Owner / Admin', manager: 'Booking Manager', viewer: 'Viewer' } as const;

export const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'qris', label: 'QRIS / e-wallet' },
  { value: 'other', label: 'Other' },
];

export const YACHT_TYPES = [
  'Motor Yacht',
  'Sailing Yacht',
  'Sailing Catamaran',
  'Power Catamaran',
  'Phinisi',
  'Sport Cruiser',
  'Speedboat',
  'Superyacht',
  'Other',
];
