import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { addYachtPhoto, createYacht, type YachtInput } from '@/api/yachts';
import { EmptyState, Screen } from '@/components/ui';
import { YachtForm } from '@/components/yacht/YachtForm';
import { showError } from '@/lib/errors';
import { useOrg } from '@/providers/WorkspaceProvider';

export default function NewYacht() {
  const { orgId, can } = useOrg();
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: async ({ input, added }: { input: YachtInput; added: string[] }) => {
      const yacht = await createYacht(orgId, input);
      for (const [i, uri] of added.entries()) await addYachtPhoto(orgId, yacht.id, uri, i);
      return yacht;
    },
    onSuccess: (y) => {
      qc.invalidateQueries({ queryKey: ['yachts'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.replace({ pathname: '/yacht/[id]', params: { id: y.id } });
    },
    onError: (e) => showError(e),
  });

  if (!can.manageFleet) return <EmptyState icon="lock-closed-outline" title="Owners only" message="Only owners can register yachts." />;
  return (
    <Screen edges={['bottom']}>
      <YachtForm submitting={create.isPending} onSubmit={(input, photos) => create.mutate({ input, added: photos.added })} />
    </Screen>
  );
}
