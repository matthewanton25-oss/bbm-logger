import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchPreferences, updatePreferences } from '@/api/notifications';
import { Card, Divider, Loading, Screen, Section, ToggleRow } from '@/components/ui';
import { showError } from '@/lib/errors';
import type { NotificationPreferences } from '@/types/models';
import { useAuth } from '@/providers/AuthProvider';

const ITEMS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'new_booking', label: 'New booking created', description: 'When a teammate adds a booking' },
  { key: 'status_changed', label: 'Booking status changed', description: 'Option → Hold, Hold → Paid, expiries…' },
  { key: 'option_expiring', label: 'Option about to expire', description: 'Before an option is auto-released' },
  { key: 'hold_expiring', label: 'Hold about to expire', description: 'Before a hold is auto-released' },
  { key: 'deposit_received', label: 'Deposit received', description: 'Booking moves to Down Payment' },
  { key: 'outstanding_balance', label: 'Outstanding balance', description: '3 days before departure (owners)' },
  { key: 'upcoming_charter', label: 'Upcoming charter tomorrow', description: '24h before departure' },
  { key: 'booking_cancelled', label: 'Booking cancelled', description: 'When a booking is cancelled' },
];

export default function NotificationSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['prefs', user?.id];
  const q = useQuery({ queryKey: key, queryFn: () => fetchPreferences(user!.id), enabled: !!user });
  const save = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) => updatePreferences(user!.id, patch),
    onMutate: async (patch) => {
      const prev = qc.getQueryData<NotificationPreferences>(key);
      if (prev) qc.setQueryData(key, { ...prev, ...patch });
      return { prev };
    },
    onError: (e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      showError(e);
    },
  });

  const p = q.data;
  if (!p) return <Loading />;
  return (
    <Screen edges={['bottom']}>
      <Card style={{ paddingVertical: 4 }}>
        <ToggleRow label="Push notifications" description="Deliver alerts to this phone. In-app inbox always stays on." value={p.push_enabled} onChange={(v) => save.mutate({ push_enabled: v })} />
      </Card>
      <Section title="Notify me about">
        <Card style={{ paddingVertical: 4 }}>
          {ITEMS.map((it, i) => (
            <View key={it.key}>
              {i > 0 && <Divider />}
              <ToggleRow label={it.label} description={it.description} value={Boolean(p[it.key])} onChange={(v) => save.mutate({ [it.key]: v })} />
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
