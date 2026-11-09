import { supabase, unwrap } from '@/lib/supabase';
import type { Invitation, Membership, Organization, Profile, Role } from '@/types/models';
import * as Linking from 'expo-linking';

export async function fetchProfile(userId: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).single());
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select().single()) as Profile;
}

export async function fetchMemberships(userId: string): Promise<Membership[]> {
  return unwrap(
    await supabase
      .from('organization_members')
      .select('org_id, user_id, role, created_at, organization:organizations(*)')
      .eq('user_id', userId)
      .order('created_at'),
  ) as unknown as Membership[];
}

export async function updateOrganization(orgId: string, patch: Partial<Organization>) {
  return unwrap(await supabase.from('organizations').update(patch).eq('id', orgId).select().single()) as Organization;
}

export async function createOrganization(name: string, timezone: string, currency: string) {
  return unwrap(
    await supabase.rpc('create_organization', { p_name: name, p_timezone: timezone, p_currency: currency }),
  ) as Organization;
}

export async function fetchMembers(orgId: string): Promise<Membership[]> {
  return unwrap(
    await supabase
      .from('organization_members')
      .select('org_id, user_id, role, created_at, profile:profiles(id, email, full_name, phone, avatar_url)')
      .eq('org_id', orgId)
      .order('created_at'),
  ) as unknown as Membership[];
}

export async function updateMemberRole(orgId: string, userId: string, role: Role) {
  unwrap(await supabase.from('organization_members').update({ role }).eq('org_id', orgId).eq('user_id', userId));
}

export async function removeMember(orgId: string, userId: string) {
  unwrap(await supabase.from('organization_members').delete().eq('org_id', orgId).eq('user_id', userId));
}

export async function fetchOrgInvitations(orgId: string): Promise<Invitation[]> {
  return unwrap(
    await supabase
      .from('invitations')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ) as Invitation[];
}

export async function fetchMyInvitations(email: string): Promise<Invitation[]> {
  return unwrap(
    await supabase
      .from('invitations')
      .select('*, organization:organizations(id, name)')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending'),
  ) as Invitation[];
}

/** Uses the invite-member edge function (sends the email); falls back to the RPC if functions aren't deployed. */
export async function inviteMember(orgId: string, email: string, role: Role) {
  const payload = { org_id: orgId, email, role, redirect_to: Linking.createURL('auth-callback') };
  const { data, error } = await supabase.functions.invoke('invite-member', { body: payload });
  if (!error) return data as { invitation: Invitation; emailed: boolean };
  // Surface real permission errors; fall back only when the function is unreachable.
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.status === 'number' && ctx.status !== 404) {
    const body = await ctx.json().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  const invitation = unwrap(
    await supabase.rpc('invite_member', { p_org: orgId, p_email: email, p_role: role }),
  ) as Invitation;
  return { invitation, emailed: false };
}

export async function revokeInvitation(id: string) {
  unwrap(await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id));
}

export async function acceptPendingInvitations(): Promise<number> {
  const { data, error } = await supabase.rpc('accept_pending_invitations');
  if (error) return 0;
  return (data as number) ?? 0;
}

export async function loadDemoFleet(orgId: string) {
  return unwrap(await supabase.rpc('seed_demo_fleet', { p_org: orgId }));
}
