import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { overlaps } from '@/lib/datetime';
import { colors, STATUS } from '@/lib/theme';
import type { CalEvent } from './types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_BARS = 3;

export function monthGridStart(month: Date) {
  return startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
}

export const MonthView = memo(function MonthView({
  month,
  today,
  selected,
  events,
  onSelect,
  showYachtNames,
}: {
  month: Date;
  today: Date;
  selected: Date;
  events: CalEvent[];
  onSelect: (day: Date) => void;
  showYachtNames: boolean;
}) {
  const days = useMemo(() => {
    const start = monthGridStart(month);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const byDay = useMemo(
    () =>
      days.map((d) => {
        const end = addDays(d, 1);
        return events.filter((e) => overlaps(e.start, e.end, d, end));
      }),
    [days, events],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, week) => (
        <View key={week} style={styles.row}>
          {days.slice(week * 7, week * 7 + 7).map((day, i) => {
            const idx = week * 7 + i;
            const list = byDay[idx];
            const inMonth = isSameMonth(day, month);
            const isToday = isSameDay(day, today);
            const isSel = isSameDay(day, selected);
            return (
              <Pressable
                key={idx}
                onPress={() => onSelect(day)}
                style={[styles.cell, isSel && styles.cellSelected]}
                accessibilityLabel={`${format(day, 'EEEE d MMMM')}, ${list.length} bookings`}
              >
                <View style={[styles.dateBubble, isToday && styles.todayBubble]}>
                  <Text
                    style={[
                      styles.date,
                      !inMonth && { color: colors.faint },
                      isToday && { color: colors.white },
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                </View>
                {list.slice(0, MAX_BARS).map((e) => {
                  const m = STATUS[e.booking.status];
                  const continuesLeft = e.start < day;
                  const continuesRight = e.end > addDays(day, 1);
                  return (
                    <View
                      key={e.booking.id}
                      style={[
                        styles.bar,
                        { backgroundColor: m.color },
                        continuesLeft && styles.barLeft,
                        continuesRight && styles.barRight,
                        !inMonth && { opacity: 0.5 },
                      ]}
                    >
                      {showYachtNames && (!continuesLeft || day.getDay() === 1) && (
                        <Text numberOfLines={1} style={[styles.barText, { color: m.onColor }]}>
                          {e.booking.yacht?.name ?? ''}
                        </Text>
                      )}
                    </View>
                  );
                })}
                {list.length > MAX_BARS && <Text style={styles.more}>+{list.length - MAX_BARS}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8 },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.faint, paddingVertical: 6 },
  cell: {
    flex: 1,
    minHeight: 78,
    paddingTop: 4,
    paddingHorizontal: 1,
    borderRadius: 10,
    alignItems: 'stretch',
  },
  cellSelected: { backgroundColor: colors.accentSoft },
  dateBubble: {
    alignSelf: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  todayBubble: { backgroundColor: colors.navy },
  date: { fontSize: 13, fontWeight: '600', color: colors.navy },
  bar: { height: 13, borderRadius: 4, marginBottom: 2, marginHorizontal: 2, justifyContent: 'center', paddingHorizontal: 2 },
  barLeft: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1 },
  barRight: { borderTopRightRadius: 0, borderBottomRightRadius: 0, marginRight: -1 },
  barText: { fontSize: 8.5, fontWeight: '700' },
  more: { fontSize: 10, color: colors.muted, textAlign: 'center', fontWeight: '600' },
});
