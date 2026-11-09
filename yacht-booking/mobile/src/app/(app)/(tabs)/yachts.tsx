import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchYachts } from '@/api/yachts';
import { loadDemoFleet } from '@/api/workspace';
import { YachtImage } from '@/components/yacht/YachtImage';
import { Button, Card, Chip, EmptyState, Fab, Loading } from '@/components/ui';
import { showError } from '@/lib/errors';
import { colors, font, radius } from '@/lib/theme';
import type { Yacht } from '@/types/models';
import { useOrg } from '@/providers/WorkspaceProvider';

export default function YachtsScreen() {
  const { orgId, can } = useOrg();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const q = useQuery({ queryKey: ['yachts', orgId, 'all'], queryFn: () => fetchYachts(orgId, true) });
  const demo = useMutation({
    mutationFn: () => loadDemoFleet(orgId),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => showError(e, 'Could not load demo fleet'),
  });

  const all = q.data ?? [];
  const yachts = all.filter((y) => (showArchived ? y.status === 'archived' : y.status !== 'archived'));
  const archivedCount = all.filter((y) => y.status === 'archived').length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={font.h1}>Fleet</Text>
        <Text style={font.small}>{all.filter((y) => y.status === 'active').length} active yachts</Text>
      </View>
      {archivedCount > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 8 }}>
          <Chip label="Fleet" active={!showArchived} onPress={() => setShowArchived(false)} />
          <Chip label={`Archived (${archivedCount})`} active={showArchived} onPress={() => setShowArchived(true)} />
        </View>
      )}
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={yachts}
          keyExtractor={(y) => y.id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.accent} />}
          renderItem={({ item }) => <YachtTile yacht={item} />}
          ListEmptyComponent={
            <EmptyState icon="boat-outline" title="No yachts yet" message="Register your yachts to manage their availability.">
              {can.manageFleet && <Button title="Add a yacht" icon="add" onPress={() => router.push('/yacht/new')} />}
              {can.manageFleet && !all.length && (
                <Button title="Load sample fleet" variant="secondary" icon="sparkles-outline" onPress={() => demo.mutate()} loading={demo.isPending} />
              )}
            </EmptyState>
          }
        />
      )}
      {can.manageFleet && yachts.length > 0 && <Fab onPress={() => router.push('/yacht/new')} label="Yacht" />}
    </SafeAreaView>
  );
}

function YachtTile({ yacht: y }: { yacht: Yacht }) {
  return (
    <Card style={styles.tile} onPress={() => router.push({ pathname: '/yacht/[id]', params: { id: y.id } })}>
      <YachtImage uri={y.photos?.[0]?.url} style={styles.img} />
      <View style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={font.h3}>{y.name}</Text>
          {y.status !== 'active' && (
            <Text style={styles.inactive}>{y.status === 'archived' ? 'Archived' : 'Inactive'}</Text>
          )}
        </View>
        <Text style={font.small}>
          {y.yacht_type}
          {y.length_m ? ` · ${y.length_m} m` : ''} · {y.capacity} guests
        </Text>
        {y.home_marina && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location-outline" size={14} color={colors.muted} />
            <Text style={font.small}>{y.home_marina}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  tile: { padding: 0, overflow: 'hidden', marginBottom: 14 },
  img: { height: 168, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  inactive: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
