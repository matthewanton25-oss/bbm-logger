import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { createBooking, type BookingInput, type PaymentInput } from '@/api/bookings';
import { fetchYachts } from '@/api/yachts';
import { BookingForm } from '@/components/booking/BookingForm';
import { Button, EmptyState, Loading, Screen } from '@/components/ui';
import { showError } from '@/lib/errors';
import { useOrg } from '@/providers/WorkspaceProvider';

export default function NewBooking() {
  const { org, orgId, can } = useOrg();
  const params = useLocalSearchParams<{ yachtId?: string; start?: string; status?: string }>();
  const qc = useQueryClient();
  const yachtsQ = useQuery({ queryKey: ['yachts', orgId], queryFn: () => fetchYachts(orgId) });

  const create = useMutation({
    mutationFn: ({ input, payment }: { input: BookingInput; payment: PaymentInput | null }) => createBooking(input, payment),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.replace({ pathname: '/booking/[id]', params: { id: b.id } });
    },
    onError: (e) => showError(e, 'Booking not created'),
  });

  if (!can.editBookings)
    return <EmptyState icon="lock-closed-outline" title="View-only access" message="Ask an owner for Booking Manager access to create bookings." />;
  if (yachtsQ.isLoading) return <Loading />;
  const yachts = (yachtsQ.data ?? []).filter((y) => y.status === 'active');
  if (!yachts.length)
    return (
      <Screen>
        <EmptyState icon="boat-outline" title="No active yachts" message="Add a yacht before creating bookings.">
          {can.manageFleet && <Button title="Add yacht" onPress={() => router.replace('/yacht/new')} />}
        </EmptyState>
      </Screen>
    );

  return (
    <Screen edges={['bottom']}>
      <BookingForm
        mode="create"
        org={org}
        yachts={yachts}
        defaults={{ yachtId: params.yachtId, start: params.start, status: params.status === 'blocked' && can.blockDates ? 'blocked' : undefined }}
        canBlock={can.blockDates}
        canRecordPayment={can.managePayments}
        submitting={create.isPending}
        onSubmit={(input, payment) => create.mutate({ input, payment })}
      />
    </Screen>
  );
}
