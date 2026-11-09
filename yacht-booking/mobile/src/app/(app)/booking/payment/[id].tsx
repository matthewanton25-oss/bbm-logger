import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { fetchBooking, recordPayment } from '@/api/bookings';
import { Button, Card, DateTimeField, EmptyState, InfoRow, Loading, OptionPicker, Screen, Segmented, TextField } from '@/components/ui';
import { fromWall, nowWall } from '@/lib/datetime';
import { showError } from '@/lib/errors';
import { money, parseAmount, PAYMENT_METHODS } from '@/lib/format';
import { colors, font } from '@/lib/theme';
import { useOrg } from '@/providers/WorkspaceProvider';

export default function RecordPayment() {
  const { id, intent } = useLocalSearchParams<{ id: string; intent?: 'deposit' | 'balance' }>();
  const { tz, can } = useOrg();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['booking', id], queryFn: () => fetchBooking(id) });
  const [kind, setKind] = useState<'payment' | 'refund'>('payment');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [paidAt, setPaidAt] = useState(nowWall(tz));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();

  const b = q.data;
  useEffect(() => {
    if (!b || amount) return;
    const suggested = intent === 'deposit' && b.deposit_amount > 0 && b.amount_paid === 0 ? b.deposit_amount : b.balance_due;
    if (suggested > 0) setAmount(String(suggested));
  }, [b, intent, amount]);

  const save = useMutation({
    mutationFn: () =>
      recordPayment(id, {
        kind,
        amount: parseAmount(amount),
        method,
        paid_at: fromWall(paidAt, tz).toISOString(),
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      ['booking', 'bookings', 'payments', 'activity', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      router.back();
    },
    onError: (e) => showError(e, 'Payment not recorded'),
  });

  if (!can.managePayments)
    return <EmptyState icon="lock-closed-outline" title="Owners only" message="Only owners can record payments." />;
  if (!b) return <Loading />;

  const n = parseAmount(amount);
  const after = kind === 'payment' ? b.amount_paid + n : b.amount_paid - n;
  const willBe =
    kind === 'payment' && b.total_price > 0 && after >= b.total_price
      ? 'PAID'
      : kind === 'payment' && (b.status === 'option' || b.status === 'hold') && n > 0
        ? 'DOWN PAYMENT'
        : null;

  return (
    <Screen edges={['bottom']}>
      <Card style={{ marginBottom: 20 }}>
        <Text style={font.h3}>{b.customer_name}</Text>
        <Text style={font.small}>
          {b.yacht?.name} · {b.ref}
        </Text>
        <InfoRow label="Total" value={money(b.total_price, b.currency)} />
        <InfoRow label="Paid" value={money(b.amount_paid, b.currency)} />
        <InfoRow label="Balance" value={money(b.balance_due, b.currency)} />
      </Card>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'payment', label: 'Payment' },
          { value: 'refund', label: 'Refund' },
        ]}
      />
      <TextField label={`Amount (${b.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={error} style={{ marginTop: 16 }} />
      <OptionPicker label="Method" value={method} onChange={setMethod} options={PAYMENT_METHODS} />
      <DateTimeField label="Payment date" value={paidAt} onChange={setPaidAt} />
      <TextField label="Reference" value={reference} onChangeText={setReference} placeholder="Bank transfer ID, receipt no." />
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      {willBe && <Text style={{ color: colors.accentDark, fontWeight: '600', marginBottom: 12 }}>Booking will move to {willBe}.</Text>}
      <Button
        title={kind === 'payment' ? 'Record payment' : 'Record refund'}
        onPress={() => {
          if (n <= 0) return setError('Enter an amount');
          if (kind === 'refund' && n > b.amount_paid) return setError('Refund exceeds amount paid');
          setError(undefined);
          save.mutate();
        }}
        loading={save.isPending}
        icon="cash-outline"
      />
      <Text style={[font.tiny, { textAlign: 'center', marginTop: 10 }]}>Payments are append-only. Correct mistakes with a refund entry.</Text>
    </Screen>
  );
}
