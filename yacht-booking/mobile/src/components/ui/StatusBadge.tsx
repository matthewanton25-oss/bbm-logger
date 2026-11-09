import { StyleSheet, Text, View } from 'react-native';

import { STATUS } from '@/lib/theme';
import type { AvailabilityStatus } from '@/types/models';

export function StatusBadge({ status, solid, small }: { status: AvailabilityStatus; solid?: boolean; small?: boolean }) {
  const m = STATUS[status];
  return (
    <View style={[styles.badge, small && styles.small, { backgroundColor: solid ? m.color : m.soft }]}>
      {!solid && <View style={[styles.dot, { backgroundColor: m.color }]} />}
      <Text style={[styles.text, small && { fontSize: 11 }, { color: solid ? m.onColor : '#0B1F3A' }]}>{m.label}</Text>
    </View>
  );
}

export function StatusLegend({ statuses }: { statuses: AvailabilityStatus[] }) {
  return (
    <View style={styles.legend}>
      {statuses.map((s) => (
        <View key={s} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: STATUS[s].color }]} />
          <Text style={styles.legendText}>{STATUS[s].label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
  },
  small: { height: 22, paddingHorizontal: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 11, color: '#6B7A90', fontWeight: '600' },
});
