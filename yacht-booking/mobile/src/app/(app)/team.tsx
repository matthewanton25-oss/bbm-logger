import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { fetchMembers, fetchOrgInvitations, inviteMember, removeMember, revokeInvitation, updateMemberRole } from '@/api/workspace';
import { Avatar, Button, Card, OptionPicker, Screen, Section, TextField } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { ROLE_LABEL } from '@/lib/format';
import { colors, font } from '@/lib/theme';
import type { Membership, Role } from '@/types/models';
import { useAuth } from '@/providers/AuthProvider';
import { useOrg } from '@/providers/WorkspaceProvider';

const ROLE_DESC: Record<Role, string> = {
  owner: 'Full access: fleet, bookings, payments, team & settings',
  manager: 'Create/edit bookings, update statuses, manage customers',
  viewer: 'View availability & calendar only',
};

export default function TeamScreen() {
  const { orgId, can } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ['members', orgId], queryFn: () => fetchMembers(orgId) });
  const invites = useQuery({ queryKey: ['invitations', orgId], queryFn: () => fetchOrgInvitations(orgId), enabled: can.manageTeam });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('manager');

  const onError = (e: unknown) => Alert.alert('Not saved', friendlyError(e));
  const invite = useMutation({
    mutationFn: () => inviteMember(orgId, email.trim().toLowerCase(), role),
    onSuccess: (r) => {
      setEmail('');
      invites.refetch();
      Alert.alert(
        'Invitation sent',
        r.emailed
          ? `${r.invitation.email} will receive an email to join.`
          : `${r.invitation.email} can accept the invitation after signing in with this email.`,
      );
    },
    onError,
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, role: r }: { userId: string; role: Role }) => updateMemberRole(orgId, userId, r),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
    onError,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(orgId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
    onError,
  });
  const revoke = useMutation({ mutationFn: revokeInvitation, onSuccess: () => invites.refetch(), onError });

  const manage = (m: Membership) => {
    if (!can.manageTeam || m.user_id === user?.id) return;
    Alert.alert(m.profile?.full_name ?? m.profile?.email ?? 'Member', 'Change role or remove access', [
      ...(['owner', 'manager', 'viewer'] as Role[])
        .filter((r) => r !== m.role)
        .map((r) => ({ text: `Make ${ROLE_LABEL[r]}`, onPress: () => changeRole.mutate({ userId: m.user_id, role: r }) })),
      { text: 'Remove from team', style: 'destructive' as const, onPress: () => remove.mutate(m.user_id) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <Screen edges={['bottom']} refreshing={members.isRefetching} onRefresh={() => members.refetch()}>
      <Section title={`Members (${members.data?.length ?? 0})`}>
        <Card style={{ paddingVertical: 4 }}>
          {(members.data ?? []).map((m, i) => (
            <Pressable
              key={m.user_id}
              onPress={() => manage(m)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
            >
              <Avatar url={m.profile?.avatar_url} name={m.profile?.full_name ?? m.profile?.email} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={[font.body, { fontWeight: '600' }]}>
                  {m.profile?.full_name ?? m.profile?.email}
                  {m.user_id === user?.id ? ' (you)' : ''}
                </Text>
                <Text style={font.small}>{m.profile?.email}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: m.role === 'owner' ? colors.accentDark : colors.muted }}>{ROLE_LABEL[m.role]}</Text>
            </Pressable>
          ))}
        </Card>
        {can.manageTeam && <Text style={[font.tiny, { marginTop: 8 }]}>Tap a member to change their role or remove access.</Text>}
      </Section>

      {can.manageTeam && (
        <>
          <Section title="Invite a team member">
            <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="captain@yourcompany.com" />
            <OptionPicker
              label="Role"
              value={role}
              onChange={setRole}
              options={(['manager', 'viewer', 'owner'] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              hint={ROLE_DESC[role]}
            />
            <Button title="Send invitation" icon="paper-plane-outline" onPress={() => invite.mutate()} loading={invite.isPending} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} />
          </Section>

          {(invites.data ?? []).length > 0 && (
            <Section title="Pending invitations">
              <Card style={{ paddingVertical: 4 }}>
                {invites.data!.map((inv, i) => (
                  <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[font.body, { fontWeight: '500' }]}>{inv.email}</Text>
                      <Text style={font.small}>{ROLE_LABEL[inv.role]}</Text>
                    </View>
                    <Pressable onPress={() => revoke.mutate(inv.id)} hitSlop={8}>
                      <Text style={{ color: colors.danger, fontWeight: '600' }}>Revoke</Text>
                    </Pressable>
                  </View>
                ))}
              </Card>
            </Section>
          )}
        </>
      )}

      <Section title="Roles">
        {(Object.keys(ROLE_DESC) as Role[]).map((r) => (
          <View key={r} style={{ marginBottom: 10 }}>
            <Text style={[font.body, { fontWeight: '600' }]}>{ROLE_LABEL[r]}</Text>
            <Text style={font.small}>{ROLE_DESC[r]}</Text>
          </View>
        ))}
      </Section>
    </Screen>
  );
}
