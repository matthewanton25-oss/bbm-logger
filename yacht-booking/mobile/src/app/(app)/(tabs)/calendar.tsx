import { Ionicons } from '@expo/vector-icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchBookingsInRange } from '@/api/bookings';
import { fetchYachts } from '@/api/yachts';
import { BookingCard } from '@/components/booking/BookingCard';
import { toWallParam } from '@/components/booking/BookingForm';
import { MonthView, monthGridStart } from '@/components/calendar/MonthView';
import { TimeGrid, type GridColumn } from '@/components/calendar/TimeGrid';
import type { CalEvent } from '@/components/calendar/types';
import { Button, Chip, ChipRow, Fab, Segmented, StatusLegend } from '@/components/ui';
import { nowWall, overlaps, todayWall, toWall, wallRangeToUtc } from '@/lib/datetime';
import { ACTIVE_STATUSES, CALENDAR_STATUSES, colors, font, STATUS } from '@/lib/theme';
import type { BookingStatus } from '@/types/models';
import { useOrg } from '@/providers/WorkspaceProvider';

type View_ = 'month' | 'week' | 'day';

export default function CalendarScreen() {
  const { orgId, tz, can } = useOrg();
  const params = useLocalSearchParams<{ yachtId?: string; date?: string }>();
  const [view, setView] = useState<View_>('month');
  const [anchor, setAnchor] = useState(() => todayWall(tz));
  const [selected, setSelected] = useState(() => todayWall(tz));
  const [yachtId, setYachtId] = useState<string | null>(params.yachtId ?? null);
  const [statuses, setStatuses] = useState<BookingStatus[]>(ACTIVE_STATUSES);

  // Deep links from yacht screens: /calendar?yachtId=…
  useEffect(() => {
    if (params.yachtId) setYachtId(params.yachtId);
  }, [params.yachtId]);

  const today = todayWall(tz);
  const now = nowWall(tz);

  const range = useMemo(() => {
    if (view === 'month') {
      const from = monthGridStart(anchor);
      return { from, to: addDays(from, 42) };
    }
    if (view === 'week') {
      const from = startOfWeek(anchor, { weekStartsOn: 1 });
      return { from, to: addDays(from, 7) };
    }
    const from = startOfDay(anchor);
    return { from, to: addDays(from, 1) };
  }, [view, anchor]);

  const utc = wallRangeToUtc(range.from, range.to, tz);
  const yachtsQ = useQuery({ queryKey: ['yachts', orgId], queryFn: () => fetchYachts(orgId) });
  const bookingsQ = useQuery({
    queryKey: ['bookings', 'range', orgId, utc.from, utc.to],
    queryFn: () => fetchBookingsInRange(orgId, utc.from, utc.to, { statuses: CALENDAR_STATUSES }),
    placeholderData: keepPreviousData,
  });

  const yachts = yachtsQ.data ?? [];
  const events: CalEvent[] = useMemo(
    () =>
      (bookingsQ.data ?? [])
        .filter((b) => statuses.includes(b.status) && (!yachtId || b.yacht_id === yachtId))
        .map((b) => ({ booking: b, start: toWall(b.starts_at, tz), end: toWall(b.ends_at, tz) })),
    [bookingsQ.data, statuses, yachtId, tz],
  );

  const shift = (dir: 1 | -1) => {
    const next = view === 'month' ? addMonths(anchor, dir) : view === 'week' ? addWeeks(anchor, dir) : addDays(anchor, dir);
    setAnchor(next);
    if (view !== 'month') setSelected(next);
  };

  const goToday = () => {
    setAnchor(today);
    setSelected(today);
  };

  const toggleStatus = (s: BookingStatus) =>
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const newBooking = (at?: Date, forYacht?: string | null) =>
    router.push({
      pathname: '/booking/new',
      params: {
        ...(at ? { start: toWallParam(at) } : {}),
        ...((forYacht ?? yachtId) ? { yachtId: (forYacht ?? yachtId)! } : {}),
      },
    });
  const openBooking = (id: string) => router.push({ pathname: '/booking/[id]', params: { id } });

  const title =
    view === 'month'
      ? format(anchor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(range.from, 'd MMM')} – ${format(addDays(range.to, -1), 'd MMM yyyy')}`
        : format(anchor, 'EEEE, d MMM yyyy');

  // ----- week & day columns
  const columns: GridColumn[] = useMemo(() => {
    if (view === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const day = addDays(range.from, i);
        return {
          key: day.toISOString(),
          title: format(day, 'EEE'),
          subtitle: format(day, 'd'),
          dayStart: day,
          highlight: isSameDay(day, today),
          events: events.filter((e) => overlaps(e.start, e.end, day, addDays(day, 1))),
          onPressHeader: () => {
            setAnchor(day);
            setSelected(day);
            setView('day');
          },
        };
      });
    }
    if (view === 'day') {
      const day = range.from;
      const shown = yachtId ? yachts.filter((y) => y.id === yachtId) : yachts.filter((y) => y.status === 'active');
      return shown.map((y) => ({
        key: y.id,
        title: y.name,
        subtitle: `${y.capacity} pax`,
        dayStart: day,
        events: events.filter((e) => e.booking.yacht_id === y.id),
      }));
    }
    return [];
  }, [view, range.from, events, yachts, yachtId, today]);

  const dayEvents = useMemo(
    () => events.filter((e) => overlaps(e.start, e.end, selected, addDays(selected, 1))),
    [events, selected],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Pressable onPress={() => shift(-1)} hitSlop={10} style={styles.nav}>
            <Ionicons name="chevron-back" size={20} color={colors.navy} />
          </Pressable>
          <Text style={[font.h2, { flex: 1, textAlign: 'center', fontSize: 19 }]} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={10} style={styles.nav}>
            <Ionicons name="chevron-forward" size={20} color={colors.navy} />
          </Pressable>
          <Pressable onPress={goToday} style={styles.today}>
            <Text style={styles.todayText}>Today</Text>
          </Pressable>
        </View>
        <Segmented
          value={view}
          onChange={(v) => {
            setView(v);
            setAnchor(selected);
          }}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
          ]}
        />
      </View>

      <View style={{ gap: 8, paddingBottom: 6 }}>
        <ChipRow>
          <Chip label="All yachts" active={!yachtId} onPress={() => setYachtId(null)} />
          {yachts.map((y) => (
            <Chip key={y.id} label={y.name} active={yachtId === y.id} onPress={() => setYachtId(yachtId === y.id ? null : y.id)} />
          ))}
        </ChipRow>
        <ChipRow>
          {CALENDAR_STATUSES.map((s) => (
            <Chip key={s} label={STATUS[s].label} color={STATUS[s].color} active={statuses.includes(s)} onPress={() => toggleStatus(s)} />
          ))}
        </ChipRow>
      </View>

      {view === 'month' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
          <MonthView month={anchor} today={today} selected={selected} events={events} onSelect={setSelected} showYachtNames={!yachtId} />
          <StatusLegend statuses={['available', 'option', 'hold', 'down_payment', 'paid', 'blocked']} />
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            <View style={styles.agendaHead}>
              <Text style={font.h3}>{format(selected, 'EEEE d MMMM')}</Text>
              <Text style={font.small}>{dayEvents.length} booking{dayEvents.length === 1 ? '' : 's'}</Text>
            </View>
            {dayEvents.map((e) => (
              <BookingCard key={e.booking.id} booking={e.booking} tz={tz} onPress={() => openBooking(e.booking.id)} />
            ))}
            {dayEvents.length === 0 && (
              <Text style={[font.small, { marginBottom: 12 }]}>
                {yachtId ? `${yachts.find((y) => y.id === yachtId)?.name ?? 'Yacht'} is available all day.` : 'All yachts available.'}
              </Text>
            )}
            {can.editBookings && (
              <Button
                title={`Book ${format(selected, 'd MMM')}`}
                icon="add-circle-outline"
                variant="secondary"
                onPress={() => {
                  const at = new Date(selected);
                  at.setHours(9, 0, 0, 0);
                  newBooking(at);
                }}
              />
            )}
          </View>
        </ScrollView>
      ) : columns.length === 0 ? (
        <Text style={[font.small, { padding: 20 }]}>Add a yacht to see its schedule.</Text>
      ) : (
        <TimeGrid
          columns={columns}
          now={now}
          onPressEvent={(b) => openBooking(b.id)}
          onPressSlot={can.editBookings ? (col, at) => newBooking(at, view === 'day' ? col.key : null) : undefined}
          columnWidth={view === 'day' && columns.length > 3 ? 132 : undefined}
        />
      )}

      {can.editBookings && <Fab onPress={() => newBooking()} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nav: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  today: { marginLeft: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, justifyContent: 'center' },
  todayText: { color: colors.accentDark, fontWeight: '700', fontSize: 13 },
  agendaHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
});
