import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { fetchNotifications, markAllRead, markRead } from '@/api/notifications';
import { EmptyState, Loading } from '@/components/ui';
import { relativeFromNow } from '@/lib/datetime';
import { colors, font } from '@/lib/theme';
import type { AppNotification } from '@/types/models';
import { useAuth } from '@/providers/AuthProvider';

const ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  new_booking: 'add-circle',
  status_changed: 'swap-horizontal',
  option_expiring: 'hourglass',
  hold_expiring: 'hourglass',
  deposit_received: 'cash',
  outstanding_balance: 'alert-circle',
  upcoming_charter: 'boat',
  booking_cancelled: 'close-circle',
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications', user?.id], queryFn: () => fetchNotifications(user!.id), enabled: !!user });
  const readAll = useMutation({ mutationFn: () => markAllRead(user!.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

  const open = async (n: AppNotification) => {
    if (!n.read_at) markRead(n.id).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
    if (n.booking_id) router.push({ pathname: '/booking/[id]', params: { id: n.booking_id } });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => readAll.mutate()} hitSlop={8}>
              <Text style={{ color: colors.accentDark, fontWeight: '600' }}>Mark all read</Text>
            </Pressable>
          ),
        }}
      />
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(n) => n.id}
          style={{ backgroundColor: colors.bg }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.accent} />}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="You're all caught up" message="Booking activity from your team will appear here." />}
          renderItem={({ item: n }) => (
            <Pressable
              onPress={() => open(n)}
              style={{ flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: n.read_at ? colors.bg : colors.accentSoft }}
            >
              <Ionicons name={ICON[n.type] ?? 'notifications'} size={22} color={colors.accentDark} />
              <View style={{ flex: 1 }}>
                <Text style={[font.body, { fontWeight: n.read_at ? '500' : '700' }]}>{n.title}</Text>
                {n.body && <Text style={font.small}>{n.body}</Text>}
                <Text style={[font.tiny, { marginTop: 4 }]}>{relativeFromNow(n.created_at)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </>
  );
}
