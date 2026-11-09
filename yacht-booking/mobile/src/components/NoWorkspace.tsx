import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Text } from 'react-native';

import { acceptPendingInvitations, createOrganization, fetchMyInvitations } from '@/api/workspace';
import { Button, Card, EmptyState, Screen, TextField } from '@/components/ui';
import { showError } from '@/lib/errors';
import { ROLE_LABEL } from '@/lib/format';
import { font } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkspace } from '@/providers/WorkspaceProvider';

/** Shown when a signed-in user belongs to no workspace yet (e.g. invited but not yet accepted). */
export function NoWorkspace() {
  const { user, signOut } = useAuth();
  const { refresh, profile } = useWorkspace();
  const [name, setName] = useState(profile?.company_name ?? '');
  const [busy, setBusy] = useState(false);
  const invites = useQuery({
    queryKey: ['my-invitations', user?.email],
    queryFn: () => fetchMyInvitations(user?.email ?? ''),
    enabled: !!user?.email,
  });

  const accept = async () => {
    setBusy(true);
    await acceptPendingInvitations();
    await refresh();
    setBusy(false);
  };

  const create = async () => {
    try {
      setBusy(true);
      await createOrganization(name.trim() || 'My Fleet', 'Asia/Jakarta', 'IDR');
      await refresh();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <EmptyState icon="business-outline" title="No workspace yet" message="Join a team you were invited to, or create your own fleet workspace." />
      {(invites.data ?? []).map((inv) => (
        <Card key={inv.id} style={{ marginBottom: 12 }}>
          <Text style={font.h3}>{inv.organization?.name ?? 'Workspace'}</Text>
          <Text style={font.small}>Invited as {ROLE_LABEL[inv.role]}</Text>
        </Card>
      ))}
      {!!invites.data?.length && <Button title="Accept invitations" onPress={accept} loading={busy} style={{ marginBottom: 24 }} />}
      <TextField label="New workspace name" value={name} onChangeText={setName} placeholder="e.g. Azura Charters" />
      <Button title="Create workspace" variant="navy" onPress={create} loading={busy} />
      <Button title="Sign out" variant="ghost" onPress={signOut} style={{ marginTop: 12 }} />
    </Screen>
  );
}
