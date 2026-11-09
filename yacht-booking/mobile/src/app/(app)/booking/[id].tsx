import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addHours } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteBooking, fetchActivity, fetchBooking, fetchPayments, updateBooking, type BookingInput } from '@/api/bookings';
import { Button, Card, DateTimeField, EmptyState, InfoRow, ListRow, Loading, Screen, Section, Sheet, StatusBadge, TextField } from '@/components/ui';
import { fmtTz, formatRange, fromWall, nowWall, relativeFromNow, toWall } from '@/lib/datetime';
import { friendlyError, showError } from '@/lib/errors';
import { displayName, money, PAYMENT_METHODS } from '@/lib/format';
import { colors, font, radius, STATUS } from '@/lib/theme';
import type { Booking, BookingActivity, BookingStatus } from '@/types/models';
import { useOrg } from '@/providers/WorkspaceProvider';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tz, org, can } = useOrg();
  const qc = useQueryClient();
  const bookingQ = useQuery({ queryKey: ['booking', id], queryFn: () => fetchBooking(id) });
  const paymentsQ = useQuery({ queryKey: ['payments', id], queryFn: () => fetchPayments(id) });
  const activityQ = useQuery({ queryKey: ['activity', id], queryFn: () => fetchActivity(id) });

  const [sheet, setSheet] = useState<null | 'status' | 'extend' | 'cancel'>(null);
  const [expiry, setExpiry] = useState(nowWall(tz));
  const [cancelReason, setCancelReason] = useState('');

  const invalidate = () =>
    ['booking', 'bookings', 'dashboard', 'activity', 'payments'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const update = useMutation({
    mutationFn: (patch: Partial<BookingInput> & { cancel_reason?: string | null }) => updateBooking(id, patch),
    onSuccess: () => {
      setSheet(null);
      invalidate();
    },
    onError: (e) => Alert.alert('Not updated', friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: () => deleteBooking(id),
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (e) => showError(e, 'Could not delete'),
  });

  const b = bookingQ.data;
  if (bookingQ.isError) return <EmptyState icon="alert-circle-outline" title="Booking not found" message="It may have been deleted or you no longer have access." />;
  if (!b) return <Loading />;

  const m = STATUS[b.status];
  const isBlock = b.status === 'blocked';
  const setStatus = (status: BookingStatus, extra: Partial<BookingInput> & { cancel_reason?: string | null } = {}) => update.mutate({ status, ...extra });
  const openExtend = () => {
    setExpiry(addHours(b.expires_at ? toWall(b.expires_at, tz) : nowWall(tz), 24));
    setSheet('extend');
  };
  const recordPayment = (intent: 'deposit' | 'balance') =>
    router.push({ pathname: '/booking/payment/[id]', params: { id, intent } });

  const actions: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void; primary?: boolean }[] = [];
  if (can.editBookings) {
    switch (b.status) {
      case 'option':
        actions.push({ label: 'Convert to Hold', icon: 'lock-closed-outline', onPress: () => setStatus('hold'), primary: true });
        actions.push(
          can.managePayments
            ? { label: 'Record deposit', icon: 'cash-outline', onPress: () => recordPayment('deposit') }
            : { label: 'Mark Down Payment', icon: 'cash-outline', onPress: () => setStatus('down_payment') },
        );
        actions.push({ label: 'Extend option', icon: 'time-outline', onPress: openExtend });
        break;
      case 'hold':
        actions.push(
          can.managePayments
            ? { label: 'Confirm with deposit', icon: 'cash-outline', onPress: () => recordPayment('deposit'), primary: true }
            : { label: 'Mark Down Payment', icon: 'cash-outline', onPress: () => setStatus('down_payment'), primary: true },
        );
        actions.push({ label: 'Extend hold', icon: 'time-outline', onPress: openExtend });
        actions.push({
          label: 'Release hold',
          icon: 'lock-open-outline',
          onPress: () =>
            Alert.alert('Release hold?', 'The yacht becomes available again for this period.', [
              { text: 'Keep', style: 'cancel' },
              { text: 'Release', style: 'destructive', onPress: () => setStatus('cancelled', { cancel_reason: 'Hold released' }) },
            ]),
        });
        break;
      case 'down_payment':
        if (can.managePayments) actions.push({ label: 'Record payment', icon: 'cash-outline', onPress: () => recordPayment('balance'), primary: true });
        else actions.push({ label: 'Mark as Paid', icon: 'checkmark-done-outline', onPress: () => setStatus('paid'), primary: true });
        break;
      case 'cancelled':
      case 'expired':
        actions.push({ label: 'Reopen as Option', icon: 'refresh-outline', onPress: () => setStatus('option'), primary: true });
        break;
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: b.ref,
          headerRight: can.editBookings
            ? () => (
                <Pressable onPress={() => router.push({ pathname: '/booking/edit/[id]', params: { id } })} hitSlop={10}>
                  <Text style={{ color: colors.accentDark, fontWeight: '700', fontSize: 16 }}>Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <Screen edges={['bottom']} refreshing={bookingQ.isRefetching} onRefresh={() => { bookingQ.refetch(); paymentsQ.refetch(); activityQ.refetch(); }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: m.soft }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatusBadge status={b.status} solid />
            <Text style={[font.small, { fontWeight: '700' }]}>{b.ref}</Text>
          </View>
          <Text style={[font.h2, { marginTop: 12 }]}>{isBlock ? (b.block_reason ?? 'Blocked') : b.customer_name}</Text>
          <Pressable onPress={() => router.push({ pathname: '/yacht/[id]', params: { id: b.yacht_id } })} style={styles.heroRow}>
            <Ionicons name="boat-outline" size={16} color={colors.navySoft} />
            <Text style={[font.body, { fontWeight: '600' }]}>{b.yacht?.name}</Text>
          </Pressable>
          <View style={styles.heroRow}>
            <Ionicons name="time-outline" size={16} color={colors.navySoft} />
            <Text style={font.body}>{formatRange(b.starts_at, b.ends_at, tz)}</Text>
          </View>
          {b.expires_at && (b.status === 'option' || b.status === 'hold') && (
            <View style={[styles.expiry, { borderColor: m.color }]}>
              <Ionicons name="hourglass-outline" size={14} color={colors.navy} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.navy }}>
                Expires {fmtTz(b.expires_at, tz, 'EEE d MMM HH:mm')} ({relativeFromNow(b.expires_at)})
              </Text>
            </View>
          )}
          {b.cancel_reason && <Text style={[font.small, { marginTop: 8 }]}>Reason: {b.cancel_reason}</Text>}
        </View>

        {/* Workflow actions */}
        {actions.length > 0 && (
          <View style={{ gap: 10, marginTop: 16 }}>
            {actions.map((a) => (
              <Button key={a.label} title={a.label} icon={a.icon} variant={a.primary ? 'primary' : 'secondary'} onPress={a.onPress} loading={a.primary && update.isPending} />
            ))}
          </View>
        )}
        {can.editBookings && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button title="Change status" variant="ghost" small icon="swap-horizontal-outline" onPress={() => setSheet('status')} style={{ flex: 1 }} />
            {!['cancelled', 'expired'].includes(b.status) && (
              <Button title={isBlock ? 'Remove block' : 'Cancel booking'} variant="danger" small icon="close-circle-outline" onPress={() => { setCancelReason(''); setSheet('cancel'); }} style={{ flex: 1 }} />
            )}
          </View>
        )}

        {!isBlock && (
          <Section title="Customer">
            <Card style={{ paddingVertical: 4 }}>
              <InfoRow icon="person-outline" label="Name" value={b.customer_name ?? ''} />
              {b.customer_phone && (
                <InfoRow
                  icon="call-outline"
                  label="Phone"
                  value={
                    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                      <Text style={[font.body, { fontWeight: '500' }]}>{b.customer_phone}</Text>
                      <Pressable hitSlop={8} onPress={() => Linking.openURL(`tel:${b.customer_phone}`)}>
                        <Ionicons name="call" size={18} color={colors.accentDark} />
                      </Pressable>
                      <Pressable hitSlop={8} onPress={() => Linking.openURL(`https://wa.me/${b.customer_phone!.replace(/[^0-9]/g, '')}`)}>
                        <Ionicons name="logo-whatsapp" size={19} color="#25D366" />
                      </Pressable>
                    </View>
                  }
                />
              )}
              <InfoRow icon="mail-outline" label="Email" value={b.customer_email ?? ''} />
            </Card>
          </Section>
        )}

        <Section title={isBlock ? 'Details' : 'Charter'}>
          <Card style={{ paddingVertical: 4 }}>
            <InfoRow icon="calendar-outline" label="Start" value={fmtTz(b.starts_at, tz, 'EEE d MMM yyyy · HH:mm')} />
            <InfoRow icon="flag-outline" label="End" value={fmtTz(b.ends_at, tz, 'EEE d MMM yyyy · HH:mm')} />
            <InfoRow icon="navigate-outline" label="Pickup" value={b.pickup_location ?? ''} />
            <InfoRow icon="location-outline" label="Destination" value={b.destination ?? ''} />
            <InfoRow icon="people-outline" label="Passengers" value={b.passengers ? `${b.passengers} / ${b.yacht?.capacity}` : ''} />
            <InfoRow icon="globe-outline" label="Timezone" value={tz} />
          </Card>
          {b.notes && (
            <Card style={{ marginTop: 10, backgroundColor: colors.surface }}>
              <Text style={font.label}>Notes</Text>
              <Text style={[font.body, { marginTop: 6 }]}>{b.notes}</Text>
            </Card>
          )}
        </Section>

        {!isBlock && (
          <Section
            title="Payments"
            action={
              can.managePayments && !['cancelled', 'expired'].includes(b.status) ? (
                <Pressable onPress={() => recordPayment('balance')}>
                  <Text style={{ color: colors.accentDark, fontWeight: '700' }}>+ Record</Text>
                </Pressable>
              ) : undefined
            }
          >
            <Card>
              <View style={styles.moneyRow}>
                <MoneyStat label="Total" value={money(b.total_price, b.currency, true)} />
                <MoneyStat label="Paid" value={money(b.amount_paid, b.currency, true)} color={STATUS.paid.color} />
                <MoneyStat label="Balance" value={money(b.balance_due, b.currency, true)} color={b.balance_due > 0 ? colors.danger : colors.success} />
              </View>
              {b.total_price > 0 && (
                <View style={styles.progress}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (b.amount_paid / b.total_price) * 100)}%` }]} />
                </View>
              )}
              {b.deposit_amount > 0 && <InfoRow label="Deposit required" value={money(b.deposit_amount, b.currency)} />}
              {b.payment_reference && <InfoRow label="Latest reference" value={b.payment_reference} />}
              {(paymentsQ.data ?? []).map((p) => (
                <View key={p.id} style={styles.payment}>
                  <View style={[styles.payIcon, p.kind === 'refund' && { backgroundColor: colors.dangerSoft }]}>
                    <Ionicons name={p.kind === 'refund' ? 'arrow-undo' : 'arrow-down'} size={14} color={p.kind === 'refund' ? colors.danger : colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { fontWeight: '600' }]}>
                      {p.kind === 'refund' ? '−' : ''}
                      {money(p.amount, b.currency)}
                    </Text>
                    <Text style={font.tiny}>
                      {fmtTz(p.paid_at, tz, 'd MMM yyyy')} · {PAYMENT_METHODS.find((x) => x.value === p.method)?.label ?? p.method}
                      {p.reference ? ` · ${p.reference}` : ''} · by {displayName(p.recorder)}
                    </Text>
                    {p.notes && <Text style={font.tiny}>{p.notes}</Text>}
                  </View>
                </View>
              ))}
              {paymentsQ.data?.length === 0 && <Text style={[font.small, { marginTop: 8 }]}>No payments recorded yet.</Text>}
            </Card>
          </Section>
        )}

        <Section title="Activity">
          <Card>
            {(activityQ.data ?? []).map((a, i) => (
              <ActivityItem key={a.id} a={a} tz={tz} currency={b.currency} last={i === (activityQ.data?.length ?? 0) - 1} />
            ))}
          </Card>
          <Text style={[font.tiny, { marginTop: 10 }]}>
            Created by {displayName(b.creator)} · {fmtTz(b.created_at, tz, 'd MMM yyyy HH:mm')}
            {'\n'}Last updated by {displayName(b.updater)} · {fmtTz(b.updated_at, tz, 'd MMM yyyy HH:mm')}
          </Text>
        </Section>

        {can.manageSettings && ['cancelled', 'expired', 'blocked'].includes(b.status) && (
          <Button
            title="Delete permanently"
            variant="ghost"
            onPress={() =>
              Alert.alert('Delete booking?', 'This removes the booking and its history.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
              ])
            }
            style={{ marginTop: 24 }}
          />
        )}
      </Screen>

      <Sheet visible={sheet === 'status'} onClose={() => setSheet(null)} title="Change status">
        {(['option', 'hold', 'down_payment', 'paid', ...(can.blockDates ? ['blocked'] : []), 'cancelled'] as BookingStatus[])
          .filter((s) => s !== b.status)
          .map((s) => (
            <ListRow
              key={s}
              title={STATUS[s].label}
              subtitle={STATUS_DESC[s]}
              onPress={() => setStatus(s)}
              right={<View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: STATUS[s].color }} />}
            />
          ))}
        <Text style={[font.tiny, { marginTop: 8 }]}>
          Conflicts are validated on the server. {can.managePayments ? 'Prefer recording payments so the ledger stays accurate.' : ''}
        </Text>
      </Sheet>

      <Sheet visible={sheet === 'extend'} onClose={() => setSheet(null)} title={`Extend ${STATUS[b.status].label.toLowerCase()}`}>
        <DateTimeField label="New expiry" value={expiry} onChange={setExpiry} minimumDate={nowWall(tz)} />
        <Button title="Save expiry" loading={update.isPending} onPress={() => update.mutate({ expires_at: fromWall(expiry, tz).toISOString() })} />
      </Sheet>

      <Sheet visible={sheet === 'cancel'} onClose={() => setSheet(null)} title={isBlock ? 'Remove block' : 'Cancel booking'}>
        <TextField label="Reason (optional)" value={cancelReason} onChangeText={setCancelReason} placeholder="Weather, client request…" />
        <Text style={[font.small, { marginBottom: 14 }]}>
          The period becomes available again. History and payments are kept{b.amount_paid > 0 ? ' — record a refund separately if needed' : ''}.
        </Text>
        <Button
          title={isBlock ? 'Remove block' : 'Cancel booking'}
          variant="danger"
          loading={update.isPending}
          onPress={() => update.mutate({ status: 'cancelled', cancel_reason: cancelReason.trim() || null })}
        />
      </Sheet>
    </>
  );
}

const STATUS_DESC: Partial<Record<BookingStatus, string>> = {
  option: 'Interested — expires automatically',
  hold: 'Reserved — blocks the period, expires',
  down_payment: 'Deposit received — confirmed',
  paid: 'Fully paid',
  blocked: 'Owner block (maintenance / private)',
  cancelled: 'Cancel and free the period',
};

function MoneyStat({ label, value, color = colors.navy }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={font.tiny}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const FIELD_LABEL: Record<string, string> = {
  starts_at: 'start',
  ends_at: 'end',
  customer_name: 'customer',
  customer_phone: 'phone',
  customer_email: 'email',
  total_price: 'price',
  deposit_amount: 'deposit',
  expires_at: 'expiry',
  pickup_location: 'pickup',
  yacht_id: 'yacht',
};

function describe(a: BookingActivity, currency: string): string {
  const label = (s: BookingStatus | null) => (s ? STATUS[s].label : '');
  const c = a.changes as Record<string, unknown>;
  switch (a.action) {
    case 'created':
      return `Created as ${label(a.to_status)}`;
    case 'status_changed':
      return `${label(a.from_status)} → ${label(a.to_status)}`;
    case 'cancelled':
      return `Cancelled (was ${label(a.from_status)})`;
    case 'expired':
      return `${label(a.from_status)} expired automatically — released`;
    case 'payment_recorded':
      return `Payment ${money(Number(c.amount), currency)} received`;
    case 'refund_recorded':
      return `Refund ${money(Number(c.amount), currency)} issued`;
    default: {
      const keys = Object.keys(c).filter((k) => k !== 'status' && k !== 'amount_paid');
      return `Updated ${keys.map((k) => FIELD_LABEL[k] ?? k.replace(/_/g, ' ')).join(', ') || 'details'}`;
    }
  }
}

function ActivityItem({ a, tz, currency, last }: { a: BookingActivity; tz: string; currency: string; last: boolean }) {
  const color = a.to_status ? STATUS[a.to_status].color : a.action.includes('payment') ? STATUS.paid.color : colors.accent;
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginTop: 5 }} />
        {!last && <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
        <Text style={[font.body, { fontWeight: '500' }]}>{describe(a, currency)}</Text>
        <Text style={font.tiny}>
          {a.actor_id ? displayName(a.actor) : 'System'} · {fmtTz(a.created_at, tz, 'd MMM HH:mm')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: 18 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  expiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  moneyRow: { flexDirection: 'row', gap: 10 },
  progress: { height: 6, borderRadius: 3, backgroundColor: colors.surface, marginVertical: 12, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: STATUS.paid.color },
  payment: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-start' },
  payIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E6F6EE', alignItems: 'center', justifyContent: 'center' },
});
