import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { fetchMemberships, fetchProfile, updateProfile } from '@/api/workspace';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import type { Membership, Organization, Profile, Role } from '@/types/models';
import { useAuth } from './AuthProvider';

export interface Permissions {
  manageFleet: boolean; // add/edit/archive yachts
  editBookings: boolean; // create/edit bookings, change status
  managePayments: boolean; // record payments/refunds
  blockDates: boolean; // maintenance / private blocks
  manageTeam: boolean; // invite, roles
  manageSettings: boolean;
}

const permissionsFor = (role: Role | null): Permissions => ({
  manageFleet: role === 'owner',
  editBookings: role === 'owner' || role === 'manager',
  managePayments: role === 'owner',
  blockDates: role === 'owner',
  manageTeam: role === 'owner',
  manageSettings: role === 'owner',
});

interface WorkspaceState {
  loading: boolean;
  profile: Profile | null;
  memberships: Membership[];
  org: Organization | null;
  orgId: string | null;
  tz: string;
  currency: string;
  role: Role | null;
  can: Permissions;
  switchOrg: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const qc = useQueryClient();

  const profileQ = useQuery({ queryKey: ['profile', userId], queryFn: () => fetchProfile(userId), enabled: !!userId });
  const membershipsQ = useQuery({
    queryKey: ['memberships', userId],
    queryFn: () => fetchMemberships(userId),
    enabled: !!userId,
  });

  const memberships = membershipsQ.data ?? [];
  const active =
    memberships.find((m) => m.org_id === profileQ.data?.default_org_id) ?? memberships[0] ?? null;
  const org = active?.organization ?? null;
  const role = active?.role ?? null;

  useRealtimeSync(org?.id ?? null, userId || null);
  usePushRegistration(userId || null);

  const switchOrg = useCallback(
    async (orgId: string) => {
      await updateProfile(userId, { default_org_id: orgId });
      await qc.invalidateQueries();
    },
    [qc, userId],
  );

  const refresh = useCallback(async () => {
    await Promise.all([profileQ.refetch(), membershipsQ.refetch()]);
  }, [profileQ, membershipsQ]);

  const value = useMemo<WorkspaceState>(
    () => ({
      loading: profileQ.isLoading || membershipsQ.isLoading,
      profile: profileQ.data ?? null,
      memberships,
      org,
      orgId: org?.id ?? null,
      tz: org?.timezone ?? 'UTC',
      currency: org?.currency ?? 'IDR',
      role,
      can: permissionsFor(role),
      switchOrg,
      refresh,
    }),
    [profileQ.isLoading, profileQ.data, membershipsQ.isLoading, memberships, org, role, switchOrg, refresh],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}

/** For screens that only render once a workspace is resolved. */
export function useOrg() {
  const ws = useWorkspace();
  if (!ws.org || !ws.orgId) throw new Error('No active workspace');
  return { ...ws, org: ws.org, orgId: ws.orgId };
}
