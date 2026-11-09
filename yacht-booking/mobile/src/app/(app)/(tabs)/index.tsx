import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchDashboard } from '@/api/bookings';
import { fetchNotifications } from '@/api/notifications';
import { loadDemoFleet } from '@/api/workspace';
import { YachtImage } from '@/components/yacht/YachtImage';
import { Button, Card, EmptyState, IconButton, Loading, Screen, Section, StatusBadge } from '@/components/ui';
import { fmtTz } from '@/lib/datetime';
import { showError } from '@/lib/errors';
import { money } from '@/lib/format';
import { colors, font, radius, STATUS } from '@/lib/theme';
import type { DashboardYacht } from '@/types/models';
import { useAuth } from '@/providers/AuthProvider';
import { useOrg } from '@/providers/WorkspaceProvider';

export default function DashboardScreen() {
  const { org, orgId, tz, currency, can, profile } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ['dashboard', orgId], queryFn: () => fetchDashboard(orgId), refetchInterval: 60_000 });
  const notifications = useQuery({ queryKey: ['notifications', user?.id], queryFn: () => fetchNotifications(user!.id), enabled: !!user });
  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;

  const demo = useMutation({
    mutationFn: () => loadDemoFleet(orgId),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => showError(e, 'Could not load demo fleet'),
  });

  const d = dash.data;
  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <Screen edges={['top']} refreshing={dash.isRefetching} onRefresh={() => dash.refetch()}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={font.small}>{fmtTz(new Date(), tz, 'EEEE, d MMMM')}</Text>
          <Text style={font.h1} numberOfLines={1}>
            {firstName ? `Hi, ${firstName}` : org.name}
          </Text>
          <Text style={[font.small, { marginTop: 2 }]} numberOfLines={1}>
            {org.name}
          </Text>
        </View>
        <IconButton icon="notifications-outline" badge={unread} onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" />
      </View>

      {!d ? (
        <Loading />
      ) : d.stats.total_yachts === 0 ? (
        <Card style={{ marginTop: 24 }}>
          <EmptyState icon="boat-outline" title="Add your first yacht" message="Register your fleet to start tracking availability and bookings.">
            {can.manageFleet && <Button title="Add a yacht" icon="add" onPress={() => router.push('/yacht/new')} />}
            {can.manageFleet && (
              <Button title="Load sample fleet" variant="secondary" icon="sparkles-outline" onPress={() => demo.mutate()} loading={demo.isPending} />
            )}
          </EmptyState>
        </Card>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Available today</Text>
              <Text style={styles.heroValue}>
                {d.stats.available_today}
                <Text style={styles.heroOf}> / {d.stats.total_yachts} yachts</Text>
              </Text>
            </View>
            <View style={styles.heroSplit}>
              <Mini label="Option" value={d.stats.on_option_today} color={STATUS.option.color} />
              <Mini label="Hold" value={d.stats.on_hold_today} color={STATUS.hold.color} />
            </View>
          </View>

          <View style={styles.grid}>
            <Kpi icon="checkmark-done-outline" label="Confirmed" value={String(d.stats.confirmed_bookings)} tint={STATUS.down_payment.color} onPress={() => router.push('/bookings')} />
            <Kpi icon="wallet-outline" label="Fully paid" value={String(d.stats.paid_bookings)} tint={STATUS.paid.color} onPress={() => router.push('/bookings')} />
            <Kpi icon="navigate-outline" label="Next 7 days" value={String(d.stats.upcoming_charters_7d)} tint={colors.accentDark} onPress={() => router.push('/calendar')} />
            <Kpi
              icon="alert-circle-outline"
              label={`Outstanding · ${d.stats.outstanding_count}`}
              value={money(d.stats.outstanding_amount, currency, true)}
              tint={colors.danger}
              onPress={() => router.push({ pathname: '/bookings', params: { filter: 'unpaid' } })}
            />
          </View>

          <Section title="Today's Yacht Availability">
            {d.yachts.map((y) => (
              <YachtToday key={y.id} y={y} tz={tz} canBook={can.editBookings} />
            ))}
          </Section>

          <Section
            title="Upcoming charters"
            action={
              <Pressable onPress={() => router.push('/bookings')}>
                <Text style={{ color: colors.accentDark, fontWeight: '600' }}>See all</Text>
              </Pressable>
            }
          >
            {d.upcoming.length === 0 ? (
              <Text style={font.small}>No upcoming charters.</Text>
            ) : (
              <Card style={{ paddingVertical: 4 }}>
                {d.upcoming.map((b, i) => (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
                    style={[styles.upRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                  >
                    <View style={styles.upDate}>
                      <Text style={styles.upDay}>{fmtTz(b.starts_at, tz, 'd')}</Text>
                      <Text style={styles.upMon}>{fmtTz(b.starts_at, tz, 'MMM')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[font.body, { fontWeight: '600' }]} numberOfLines={1}>
                        {b.customer_name}
                      </Text>
                      <Text style={font.small} numberOfLines={1}>
                        {b.yacht_name} · {fmtTz(b.starts_at, tz, 'HH:mm')}
                        {b.passengers ? ` · ${b.passengers} pax` : ''}
                      </Text>
                    </View>
                    <StatusBadge status={b.status} small />
                  </Pressable>
                ))}
              </Card>
            )}
          </Section>
        </>
      )}
    </Screen>
  );
}

function YachtToday({ y, tz, canBook }: { y: DashboardYacht; tz: string; canBook: boolean }) {
  const today = y.today_booking;
  return (
    <Card style={styles.yCard} onPress={() => router.push({ pathname: '/yacht/[id]', params: { id: y.id } })}>
      <YachtImage uri={y.cover_url} style={styles.yImg} iconSize={26} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={font.h3} numberOfLines={1}>
          {y.name}
        </Text>
        <StatusBadge status={y.today_status} small />
        <Text style={font.tiny} numberOfLines={1}>
          {today
            ? `${fmtTz(today.starts_at, tz, 'HH:mm')}–${fmtTz(today.ends_at, tz, 'HH:mm')} · ${today.customer_name ?? 'Blocked'}`
            : y.next_booking
              ? `Next: ${fmtTz(y.next_booking.starts_at, tz, 'EEE d MMM HH:mm')}`
              : 'No upcoming bookings'}
        </Text>
      </View>
      {canBook && (
        <Pressable
          hitSlop={8}
          onPress={() => router.push({ pathname: '/booking/new', params: { yachtId: y.id } })}
          style={styles.quick}
          accessibilityLabel={`Book ${y.name}`}
        >
          <Ionicons name="add" size={20} color={colors.white} />
        </Pressable>
      )}
    </Card>
  );
}

function Kpi({ icon, label, value, tint, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; tint: string; onPress?: () => void }) {
  return (
    <Card style={styles.kpi} onPress={onPress}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={font.small} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: colors.white, fontSize: 22, fontWeight: '700' }}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ color: '#B9C6D8', fontSize: 11, fontWeight: '600' }}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 20, flexDirection: 'row', alignItems: 'center' },
  heroLabel: { color: '#B9C6D8', fontSize: 13, fontWeight: '600' },
  heroValue: { color: colors.white, fontSize: 38, fontWeight: '800', marginTop: 2 },
  heroOf: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  heroSplit: { flexDirection: 'row', gap: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  kpi: { width: '47.5%', gap: 4, padding: 14 },
  kpiValue: { fontSize: 22, fontWeight: '800', color: colors.navy, marginTop: 4 },
  yCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginBottom: 10 },
  yImg: { width: 76, height: 64, borderRadius: radius.md },
  quick: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  upDate: { width: 44, height: 46, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  upDay: { fontSize: 17, fontWeight: '800', color: colors.navy },
  upMon: { fontSize: 10, fontWeight: '700', color: colors.accentDark, textTransform: 'uppercase' },
});
