import { Ionicons } from '@expo/vector-icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchBookingList, type BookingListFilter } from '@/api/bookings';
import { BookingCard } from '@/components/booking/BookingCard';
import { ChipRow, Chip, EmptyState, Fab, Loading } from '@/components/ui';
import { colors, font, radius } from '@/lib/theme';
import { useOrg } from '@/providers/WorkspaceProvider';

const FILTERS: { value: BookingListFilter; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'pending', label: 'Option & Hold' },
  { value: 'unpaid', label: 'Balance due' },
  { value: 'past', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled / Expired' },
];

export default function BookingsScreen() {
  const { orgId, tz, can } = useOrg();
  const params = useLocalSearchParams<{ filter?: BookingListFilter }>();
  const [filter, setFilter] = useState<BookingListFilter>(params.filter ?? 'upcoming');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    if (params.filter) setFilter(params.filter);
  }, [params.filter]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ['bookings', 'list', orgId, filter, debounced],
    queryFn: () => fetchBookingList(orgId, filter, debounced),
    placeholderData: keepPreviousData,
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={font.h1}>Bookings</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.faint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Customer, phone or booking ID"
            placeholderTextColor={colors.faint}
            style={{ flex: 1, fontSize: 15, color: colors.text }}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>
      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </ChipRow>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.accent} />}
          renderItem={({ item }) => (
            <BookingCard booking={item} tz={tz} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.id } })} />
          )}
          ListEmptyComponent={<EmptyState icon="file-tray-outline" title="Nothing here" message="No bookings match this view." />}
        />
      )}
      {can.editBookings && <Fab onPress={() => router.push('/booking/new')} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
});
