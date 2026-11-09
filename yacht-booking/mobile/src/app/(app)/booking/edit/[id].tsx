import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { fetchBooking, updateBooking, type BookingInput } from '@/api/bookings';
import { fetchYachts } from '@/api/yachts';
import { BookingForm } from '@/components/booking/BookingForm';
import { EmptyState, Loading, Screen } from '@/components/ui';
import { showError } from '@/lib/errors';
import { useOrg } from '@/providers/WorkspaceProvider';

export default function EditBooking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { org, orgId, can } = useOrg();
  const qc = useQueryClient();
  const bookingQ = useQuery({ queryKey: ['booking', id], queryFn: () => fetchBooking(id) });
  const yachtsQ = useQuery({ queryKey: ['yachts', orgId], queryFn: () => fetchYachts(orgId) });

  const save = useMutation({
    mutationFn: (input: Partial<BookingInput>) => updateBooking(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking', id] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['activity', id] });
      router.back();
    },
    onError: (e) => showError(e),
  });

  if (!can.editBookings) return <EmptyState icon="lock-closed-outline" title="View-only access" />;
  if (!bookingQ.data || !yachtsQ.data) return <Loading />;
  const b = bookingQ.data;
  const yachts = yachtsQ.data.filter((y) => y.status === 'active' || y.id === b.yacht_id);

  return (
    <Screen edges={['bottom']}>
      <BookingForm
        mode="edit"
        org={org}
        yachts={yachts}
        initial={b}
        canBlock={can.blockDates}
        canRecordPayment={false}
        submitting={save.isPending}
        onSubmit={(input) => save.mutate(input)}
      />
    </Screen>
  );
}
