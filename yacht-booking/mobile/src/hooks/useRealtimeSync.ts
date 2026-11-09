import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Keeps every screen in sync across devices and team members.
 * Postgres changes are streamed over Supabase Realtime (RLS-filtered server-side) and
 * mapped to React Query invalidations, coalesced to avoid refetch storms.
 */
export function useRealtimeSync(orgId: string | null, userId: string | null) {
  const qc = useQueryClient();
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orgId || !userId) return;

    const queue = (...keys: string[]) => {
      keys.forEach((k) => pending.current.add(k));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        pending.current.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        pending.current.clear();
      }, 250);
    };

    const bookingKeys = ['bookings', 'booking', 'dashboard', 'payments', 'activity', 'yacht-bookings'];
    const channel = supabase
      .channel(`org-sync-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `org_id=eq.${orgId}` }, () =>
        queue(...bookingKeys),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `org_id=eq.${orgId}` }, () =>
        queue(...bookingKeys),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yachts', filter: `org_id=eq.${orgId}` }, () =>
        queue('yachts', 'yacht', 'dashboard'),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yacht_photos', filter: `org_id=eq.${orgId}` }, () =>
        queue('yachts', 'yacht', 'dashboard'),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organization_members', filter: `org_id=eq.${orgId}` },
        () => queue('members', 'memberships'),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () =>
        queue('notifications'),
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [orgId, userId, qc]);
}
