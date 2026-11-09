import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/components/ui';
import { formatRange, relativeFromNow } from '@/lib/datetime';
import { money } from '@/lib/format';
import { colors, font, radius, shadow, STATUS } from '@/lib/theme';
import type { Booking } from '@/types/models';

export function BookingCard({ booking: b, tz, onPress }: { booking: Booking; tz: string; onPress: () => void }) {
  const m = STATUS[b.status];
  const title = b.status === 'blocked' ? (b.block_reason ?? 'Blocked') : (b.customer_name ?? 'Unnamed');
  const showBalance = (b.status === 'down_payment' || b.status === 'hold') && b.balance_due > 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <View style={[styles.bar, { backgroundColor: m.color }]} />
      <View style={{ flex: 1, padding: 14, gap: 4 }}>
        <View style={styles.row}>
          <Text style={[font.h3, { flex: 1 }]} numberOfLines={1}>
            {title}
          </Text>
          <StatusBadge status={b.status} small />
        </View>
        <View style={styles.row}>
          <Ionicons name="boat-outline" size={14} color={colors.muted} />
          <Text style={font.small} numberOfLines={1}>
            {b.yacht?.name ?? '—'} · {b.ref}
          </Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="time-outline" size={14} color={colors.muted} />
          <Text style={font.small}>{formatRange(b.starts_at, b.ends_at, tz)}</Text>
        </View>
        <View style={[styles.row, { marginTop: 2 }]}>
          {!!b.passengers && <Text style={styles.meta}>{b.passengers} pax</Text>}
          {b.total_price > 0 && <Text style={styles.meta}>{money(b.total_price, b.currency)}</Text>}
          {showBalance && <Text style={[styles.meta, { color: colors.danger }]}>Due {money(b.balance_due, b.currency)}</Text>}
          {b.expires_at && (b.status === 'option' || b.status === 'hold') && (
            <Text style={[styles.meta, { color: '#B26A00' }]}>Expires {relativeFromNow(b.expires_at)}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 10,
    ...shadow,
  },
  bar: { width: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta: { fontSize: 12, fontWeight: '600', color: colors.navySoft },
});
