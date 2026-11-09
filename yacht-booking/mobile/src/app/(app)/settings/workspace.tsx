import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { updateOrganization } from '@/api/workspace';
import { Button, Card, EmptyState, OptionPicker, Screen, Section, TextField, ToggleRow } from '@/components/ui';
import { COMMON_TIMEZONES } from '@/lib/datetime';
import { showError } from '@/lib/errors';
import { font } from '@/lib/theme';
import { useOrg } from '@/providers/WorkspaceProvider';

const CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD', 'AUD', 'GBP', 'THB', 'AED'];

export default function WorkspaceSettings() {
  const { org, can, refresh } = useOrg();
  const qc = useQueryClient();
  const [name, setName] = useState(org.name);
  const [timezone, setTimezone] = useState(org.timezone);
  const [currency, setCurrency] = useState(org.currency);
  const [multi, setMulti] = useState(org.allow_multiple_options);
  const [optionHours, setOptionHours] = useState(String(org.option_default_hours));
  const [holdHours, setHoldHours] = useState(String(org.hold_default_hours));
  const [warnMinutes, setWarnMinutes] = useState(String(org.expiry_warning_minutes));

  const save = useMutation({
    mutationFn: () =>
      updateOrganization(org.id, {
        name: name.trim(),
        timezone,
        currency,
        allow_multiple_options: multi,
        option_default_hours: Number(optionHours) || 24,
        hold_default_hours: Number(holdHours) || 72,
        expiry_warning_minutes: Number(warnMinutes) || 120,
      }),
    onSuccess: async () => {
      await refresh();
      qc.invalidateQueries();
      router.back();
    },
    onError: (e) => showError(e),
  });

  if (!can.manageSettings) return <EmptyState icon="lock-closed-outline" title="Owners only" />;
  return (
    <Screen edges={['bottom']}>
      <TextField label="Workspace / company name" value={name} onChangeText={setName} />
      <OptionPicker
        label="Operating timezone"
        value={timezone}
        onChange={setTimezone}
        options={(COMMON_TIMEZONES.includes(timezone) ? COMMON_TIMEZONES : [timezone, ...COMMON_TIMEZONES]).map((t) => ({ value: t, label: t.replace('_', ' ') }))}
        hint="All charter times are shown and entered in this timezone for every team member."
      />
      <OptionPicker label="Currency" value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} hint="Applies to new bookings." />

      <Section title="Booking rules">
        <Card style={{ paddingVertical: 4, marginBottom: 16 }}>
          <ToggleRow
            label="Allow multiple options"
            description="Several customers can hold an OPTION on the same yacht and time. Holds and confirmed bookings always block."
            value={multi}
            onChange={setMulti}
          />
        </Card>
        <TextField label="Default option duration (hours)" value={optionHours} onChangeText={setOptionHours} keyboardType="number-pad" />
        <TextField label="Default hold duration (hours)" value={holdHours} onChangeText={setHoldHours} keyboardType="number-pad" />
        <TextField label="Warn before expiry (minutes)" value={warnMinutes} onChangeText={setWarnMinutes} keyboardType="number-pad" />
        <Text style={[font.tiny, { marginBottom: 16 }]}>Expired options and holds are released automatically by the server every 5 minutes.</Text>
      </Section>

      <Button title="Save settings" onPress={() => save.mutate()} loading={save.isPending} />
    </Screen>
  );
}
