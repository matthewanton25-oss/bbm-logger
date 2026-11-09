import { addDays, addHours, format, isSameDay } from 'date-fns';
import { memo, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent, type ScrollViewInstance } from 'react-native';

import { colors, STATUS } from '@/lib/theme';
import type { Booking } from '@/types/models';
import type { CalEvent } from './types';

const HOUR = 52;
const GUTTER = 46;

export interface GridColumn {
  key: string;
  title: string;
  subtitle?: string;
  /** Wall-clock start of the day shown in this column. */
  dayStart: Date;
  events: CalEvent[];
  highlight?: boolean;
  onPressHeader?: () => void;
}

interface Placed {
  event: CalEvent;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

function layout(events: CalEvent[], dayStart: Date): Placed[] {
  const dayEnd = addDays(dayStart, 1);
  const clipped = events
    .filter((e) => e.start < dayEnd && e.end > dayStart)
    .map((e) => ({
      event: e,
      s: Math.max(e.start.getTime(), dayStart.getTime()),
      en: Math.min(e.end.getTime(), dayEnd.getTime()),
    }))
    .sort((a, b) => a.s - b.s || b.en - a.en);

  // Greedy lane assignment within clusters of overlapping events.
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    cluster.forEach((p) => (p.lanes = lanes));
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const c of clipped) {
    if (c.s >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((end) => end <= c.s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(c.en);
    } else laneEnds[lane] = c.en;
    clusterEnd = Math.max(clusterEnd === -Infinity ? c.en : clusterEnd, c.en);
    const top = ((c.s - dayStart.getTime()) / 3_600_000) * HOUR;
    const height = Math.max(24, ((c.en - c.s) / 3_600_000) * HOUR - 2);
    cluster.push({ event: c.event, top, height, lane, lanes: 1 });
  }
  flush();
  return out;
}

export const TimeGrid = memo(function TimeGrid({
  columns,
  now,
  onPressEvent,
  onPressSlot,
  columnWidth,
}: {
  columns: GridColumn[];
  now: Date;
  onPressEvent: (b: Booking) => void;
  onPressSlot?: (column: GridColumn, at: Date) => void;
  /** Fixed width enables horizontal scrolling (e.g. many yachts). */
  columnWidth?: number;
}) {
  // Open at 07:00 — charters rarely start earlier. Explicit scroll works on every platform.
  const vScroll = useRef<ScrollViewInstance>(null);
  const didScroll = useRef(false);
  const placed = useMemo(() => columns.map((c) => layout(c.events, c.dayStart)), [columns]);
  const hours = Array.from({ length: 24 }, (_, h) => h);

  const body = (
    <View style={{ flex: 1 }}>
      <View style={[styles.headerRow, { paddingLeft: GUTTER }]}>
        {columns.map((c) => (
          <Pressable
            key={c.key}
            onPress={c.onPressHeader}
            style={[styles.header, columnWidth ? { width: columnWidth } : { flex: 1 }]}
          >
            <Text numberOfLines={1} style={[styles.headerTitle, c.highlight && { color: colors.accentDark }]}>
              {c.title}
            </Text>
            {c.subtitle && (
              <View style={[styles.headerSub, c.highlight && { backgroundColor: colors.navy }]}>
                <Text numberOfLines={1} style={[styles.headerSubText, c.highlight && { color: colors.white }]}>
                  {c.subtitle}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
      <ScrollView
        ref={vScroll}
        style={{ flex: 1 }}
        onLayout={() => {
          if (didScroll.current) return;
          didScroll.current = true;
          vScroll.current?.scrollTo({ y: 7 * HOUR, animated: false });
        }}
      >
        <View style={{ flexDirection: 'row', height: 24 * HOUR }}>
          <HourGutter hours={hours} />
          {columns.map((c, ci) => (
            <Pressable
              key={c.key}
              onPress={(e: GestureResponderEvent) => {
                if (!onPressSlot) return;
                const hour = Math.max(0, Math.min(23, Math.floor(e.nativeEvent.locationY / HOUR)));
                onPressSlot(c, addHours(c.dayStart, hour));
              }}
              style={[styles.column, columnWidth ? { width: columnWidth } : { flex: 1 }]}
            >
              {hours.map((h) => (
                <View key={h} style={[styles.hourLine, { top: h * HOUR }]} />
              ))}
              {isSameDay(c.dayStart, now) && (
                <View style={[styles.nowLine, { top: ((now.getTime() - c.dayStart.getTime()) / 3_600_000) * HOUR }]} />
              )}
              {placed[ci].map((p) => {
                const m = STATUS[p.event.booking.status];
                const b = p.event.booking;
                const muted = b.status === 'cancelled' || b.status === 'expired';
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => onPressEvent(b)}
                    style={[
                      styles.event,
                      {
                        top: p.top,
                        height: p.height,
                        left: `${(p.lane / p.lanes) * 100}%`,
                        width: `${100 / p.lanes}%`,
                        backgroundColor: m.soft,
                        borderLeftColor: m.color,
                        opacity: muted ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.eventTitle}>
                      {b.status === 'blocked' ? (b.block_reason ?? 'Blocked') : b.customer_name}
                    </Text>
                    {p.height > 36 && (
                      <Text numberOfLines={1} style={styles.eventSub}>
                        {format(p.event.start, 'HH:mm')}–{format(p.event.end, 'HH:mm')}
                        {columns.length > 1 && b.yacht?.name && !columnWidth ? ` · ${b.yacht.name}` : ''}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  if (!columnWidth) return <View style={{ flex: 1 }}>{body}</View>;
  // Resource view with many yachts: scroll sideways; hour labels travel with the grid.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
      {body}
    </ScrollView>
  );
});

function HourGutter({ hours }: { hours: number[] }) {
  return (
    <View style={{ width: GUTTER, height: 24 * HOUR }}>
      {hours.map((h) => (
        <Text key={h} style={[styles.hourLabel, { top: h * HOUR - 7 }]}>
          {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, height: 52 },
  header: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  headerTitle: { fontSize: 11, fontWeight: '700', color: colors.muted },
  headerSub: { marginTop: 3, minWidth: 26, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  headerSubText: { fontSize: 13, fontWeight: '700', color: colors.navy },
  column: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border, height: 24 * HOUR },
  hourLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.danger, zIndex: 5 },
  hourLabel: { position: 'absolute', right: 6, fontSize: 10, color: colors.faint, fontWeight: '600' },
  event: {
    position: 'absolute',
    borderRadius: 6,
    borderLeftWidth: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  eventTitle: { fontSize: 11, fontWeight: '700', color: colors.navy },
  eventSub: { fontSize: 10, color: colors.navySoft },
});
