import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { acceptPendingInvitations, fetchMyInvitations, updateProfile } from '@/api/workspace';
import { uploadAvatar } from '@/api/yachts';
import { Avatar, Button, Card, Divider, ListRow, Screen } from '@/components/ui';
import { showError } from '@/lib/errors';
import { ROLE_LABEL } from '@/lib/format';
import { colors, font } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useOrg } from '@/providers/WorkspaceProvider';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, org, role, memberships, switchOrg, can, refresh } = useOrg();
  const qc = useQueryClient();

  const invites = useQuery({
    queryKey: ['my-invitations', user?.email],
    queryFn: () => fetchMyInvitations(user?.email ?? ''),
    enabled: !!user?.email,
  });
  const pendingInvites = (invites.data ?? []).filter((i) => !memberships.some((m) => m.org_id === i.org_id));

  const avatar = useMutation({
    mutationFn: async () => {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
      if (res.canceled) return;
      const url = await uploadAvatar(user!.id, res.assets[0].uri);
      await updateProfile(user!.id, { avatar_url: url });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
    onError: (e) => showError(e, 'Upload failed'),
  });

  const accept = useMutation({
    mutationFn: acceptPendingInvitations,
    onSuccess: async () => {
      await refresh();
      invites.refetch();
    },
  });

  const chooseWorkspace = () =>
    Alert.alert(
      'Switch workspace',
      undefined,
      [
        ...memberships.map((m) => ({
          text: `${m.organization?.name ?? 'Workspace'}${m.org_id === org.id ? ' ✓' : ''}`,
          onPress: () => switchOrg(m.org_id),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );

  return (
    <Screen edges={['top']}>
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Pressable onPress={() => avatar.mutate()}>
          <Avatar url={profile?.avatar_url} name={profile?.full_name ?? user?.email} size={88} />
          <Text style={{ textAlign: 'center', color: colors.accentDark, fontWeight: '600', marginTop: 8 }}>
            {avatar.isPending ? 'Uploading…' : 'Change photo'}
          </Text>
        </Pressable>
        <Text style={[font.h2, { marginTop: 10 }]}>{profile?.full_name ?? 'Your profile'}</Text>
        <Text style={font.small}>{user?.email}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <Text style={pill}>{role ? ROLE_LABEL[role] : ''}</Text>
          <Text style={pill}>{profile?.account_type === 'fleet_manager' ? 'Fleet manager' : 'Yacht owner'}</Text>
        </View>
      </View>

      {pendingInvites.length > 0 && (
        <Card style={{ marginTop: 20, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
          <Text style={font.h3}>You're invited</Text>
          {pendingInvites.map((i) => (
            <Text key={i.id} style={[font.small, { marginTop: 4 }]}>
              {i.organization?.name} · {ROLE_LABEL[i.role]}
            </Text>
          ))}
          <Button title="Accept" small onPress={() => accept.mutate()} loading={accept.isPending} style={{ marginTop: 12 }} />
        </Card>
      )}

      <Card style={{ marginTop: 20, paddingVertical: 6 }}>
        <ListRow icon="business-outline" title={org.name} subtitle={`${org.timezone} · ${org.currency}`} onPress={memberships.length > 1 ? chooseWorkspace : undefined} right={memberships.length > 1 ? <Text style={{ color: colors.accentDark, fontWeight: '600' }}>Switch</Text> : <View />} />
        <Divider />
        <ListRow icon="person-outline" title="Edit profile" onPress={() => router.push('/settings/profile')} />
        <ListRow icon="people-outline" title="Team & permissions" subtitle={can.manageTeam ? 'Invite and manage roles' : 'View team'} onPress={() => router.push('/team')} />
        {can.manageSettings && <ListRow icon="options-outline" title="Workspace settings" subtitle="Timezone, currency, booking rules" onPress={() => router.push('/settings/workspace')} />}
        <ListRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
        <ListRow icon="settings-outline" title="Notification settings" onPress={() => router.push('/settings/notifications')} />
      </Card>

      <Card style={{ marginTop: 16, paddingVertical: 6 }}>
        <ListRow icon="log-out-outline" title="Sign out" danger onPress={signOut} right={<View />} />
      </Card>
    </Screen>
  );
}

const pill = {
  fontSize: 12,
  fontWeight: '700' as const,
  color: colors.navySoft,
  backgroundColor: colors.surface,
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 10,
  overflow: 'hidden' as const,
};
