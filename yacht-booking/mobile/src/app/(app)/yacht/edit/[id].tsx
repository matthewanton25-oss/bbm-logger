import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { addYachtPhoto, fetchYacht, removeYachtPhoto, updateYacht, type YachtInput } from '@/api/yachts';
import { EmptyState, Loading, Screen } from '@/components/ui';
import { YachtForm } from '@/components/yacht/YachtForm';
import { showError } from '@/lib/errors';
import type { YachtPhoto } from '@/types/models';
import { useOrg } from '@/providers/WorkspaceProvider';

export default function EditYacht() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orgId, can } = useOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['yacht', id], queryFn: () => fetchYacht(id) });

  const save = useMutation({
    mutationFn: async ({ input, added, removed }: { input: YachtInput; added: string[]; removed: YachtPhoto[] }) => {
      await updateYacht(id, input);
      for (const p of removed) await removeYachtPhoto(p);
      const start = (q.data?.photos?.length ?? 0) - removed.length;
      for (const [i, uri] of added.entries()) await addYachtPhoto(orgId, id, uri, start + i);
    },
    onSuccess: () => {
      ['yacht', 'yachts', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      router.back();
    },
    onError: (e) => showError(e),
  });

  if (!can.manageFleet) return <EmptyState icon="lock-closed-outline" title="Owners only" />;
  if (!q.data) return <Loading />;
  return (
    <Screen edges={['bottom']}>
      <YachtForm initial={q.data} submitting={save.isPending} onSubmit={(input, photos) => save.mutate({ input, ...photos })} />
    </Screen>
  );
}
