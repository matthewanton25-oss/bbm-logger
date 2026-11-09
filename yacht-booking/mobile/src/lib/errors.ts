import { Alert } from 'react-native';

interface PgLikeError {
  message?: string;
  code?: string;
  details?: string;
}

/** Turns Postgres / Supabase errors into messages a yacht owner understands. */
export function friendlyError(e: unknown): string {
  const err = (e ?? {}) as PgLikeError;
  switch (err.code) {
    case '23P01': // overlap: server already wrote a human-readable message
      return err.message?.includes('bookings_no_overlap')
        ? 'This yacht is already booked for an overlapping period.'
        : (err.message ?? 'This period conflicts with another booking.');
    case '42501':
      return err.message?.startsWith('new row violates') || err.message?.includes('permission denied')
        ? "You don't have permission to do that."
        : (err.message ?? "You don't have permission to do that.");
    case '23503':
      return 'This item is still referenced by bookings. Archive it instead.';
    case '23505':
      return err.message ?? 'That already exists.';
    case 'PGRST116':
      return 'Not found or no access.';
  }
  if (err.message === 'Network request failed') return 'No connection. Check your internet and try again.';
  return err.message ?? 'Something went wrong.';
}

export function showError(e: unknown, title = 'Could not save') {
  Alert.alert(title, friendlyError(e));
}
