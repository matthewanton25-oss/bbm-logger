import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchYachtUpcoming } from '@/api/bookings';
import { deleteYacht, fetchYacht, updateYacht } from '@/api/yachts';
import { BookingCard } from '@/components/booking/BookingCard';
import { YachtImage } from '@/components/yacht/YachtImage';
import { Button, Card, InfoRow, Loading, Screen, Section } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { colors, font, radius } from '@/lib/theme';
import { useOrg } from '@/providers/WorkspaceProvider';

const W = Dimensions.get('window').width;

export default function YachtDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tz, can } = useOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['yacht', id], queryFn: () => fetchYacht(id) });
  const upcoming = useQuery({ queryKey: ['yacht-bookings', id], queryFn: () => fetchYachtUpcoming(id) });

  const invalidate = () => ['yacht', 'yachts', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const setStatus = useMutation({
    mutationFn: (status: 'active' | 'inactive' | 'archived') => updateYacht(id, { status }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Not updated', friendlyError(e)),
  });
  const remove = useMutation({
    mutationFn: () => deleteYacht(id),
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (e) => Alert.alert('Cannot delete', friendlyError(e)),
  });

  const y = q.data;
  if (!y) return <Loading />;
  const photos = y.photos ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: y.name,
          headerRight: can.manageFleet
            ? () => (
                <Pressable onPress={() => router.push({ pathname: '/yacht/edit/[id]', params: { id } })} hitSlop={10}>
                  <Text style={{ color: colors.accentDark, fontWeight: '700', fontSize: 16 }}>Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <Screen edges={['bottom']} contentStyle={{ padding: 0, paddingBottom: 48 }} refreshing={q.isRefetching} onRefresh={() => { q.refetch(); upcoming.refetch(); }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {(photos.length ? photos.map((p) => p.url) : [null]).map((url, i) => (
            <YachtImage key={i} uri={url} style={{ width: W, height: 250 }} iconSize={56} />
          ))}
        </ScrollView>
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={font.h1}>{y.name}</Text>
            {y.status !== 'active' && <Text style={styles.status}>{y.status}</Text>}
          </View>
          <Text style={[font.body, { color: colors.muted, marginTop: 4 }]}>
            {y.yacht_type}
            {y.length_m ? ` · ${y.length_m} m` : ''}
          </Text>

          <View style={styles.specs}>
            <Spec icon="people-outline" value={`${y.capacity}`} label="Guests" />
            <Spec icon="resize-outline" value={y.length_m ? `${y.length_m}m` : '—'} label="Length" />
            <Spec icon="location-outline" value={y.home_marina?.split(',')[0] ?? '—'} label="Marina" />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button title="Calendar" icon="calendar-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/calendar', params: { yachtId: y.id } })} />
            {can.editBookings && y.status === 'active' && (
              <Button title="Book" icon="add" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/booking/new', params: { yachtId: y.id } })} />
            )}
          </View>
          {can.blockDates && y.status === 'active' && (
            <Button title="Block dates (maintenance / private)" variant="ghost" icon="construct-outline" onPress={() => router.push({ pathname: '/booking/new', params: { yachtId: y.id, status: 'blocked' } })} />
          )}

          {y.description && (
            <Section title="About">
              <Text style={[font.body, { lineHeight: 22 }]}>{y.description}</Text>
            </Section>
          )}

          <Section title="Details">
            <Card style={{ paddingVertical: 4 }}>
              <InfoRow icon="boat-outline" label="Type" value={y.yacht_type} />
              <InfoRow icon="location-outline" label="Home marina" value={y.home_marina ?? ''} />
              <InfoRow icon="document-text-outline" label="Registration" value={y.registration_number ?? ''} />
            </Card>
          </Section>

          <Section title="Upcoming schedule">
            {(upcoming.data ?? []).length === 0 ? (
              <Text style={font.small}>No upcoming bookings — fully available.</Text>
            ) : (
              upcoming.data!.map((b) => (
                <BookingCard key={b.id} booking={b} tz={tz} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })} />
              ))
            )}
          </Section>

          {can.manageFleet && (
            <Section title="Manage">
              <View style={{ gap: 10 }}>
                {y.status === 'archived' ? (
                  <Button title="Restore to fleet" variant="secondary" icon="refresh-outline" onPress={() => setStatus.mutate('active')} />
                ) : (
                  <Button
                    title="Archive yacht"
                    variant="secondary"
                    icon="archive-outline"
                    onPress={() =>
                      Alert.alert('Archive yacht?', 'It disappears from the fleet and calendar filters, history is kept.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Archive', onPress: () => setStatus.mutate('archived') },
                      ])
                    }
                  />
                )}
                <Button
                  title="Delete yacht"
                  variant="danger"
                  icon="trash-outline"
                  onPress={() =>
                    Alert.alert('Delete yacht?', 'Only possible when it has no bookings. Archive it to keep history.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
                    ])
                  }
                />
              </View>
            </Section>
          )}
        </View>
      </Screen>
    </>
  );
}

function Spec({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) {
  return (
    <View style={styles.spec}>
      <Ionicons name={icon} size={18} color={colors.accentDark} />
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy, marginTop: 4 }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={font.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'capitalize',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  specs: { flexDirection: 'row', gap: 10, marginTop: 16 },
  spec: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, alignItems: 'center' },
});
