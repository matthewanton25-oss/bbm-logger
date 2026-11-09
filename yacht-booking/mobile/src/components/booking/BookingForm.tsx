import { addHours, format, parse } from 'date-fns';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import type { BookingInput, PaymentInput } from '@/api/bookings';
import { Button, Card, DateTimeField, OptionPicker, TextField } from '@/components/ui';
import { fromWall, nowWall, toWall } from '@/lib/datetime';
import { money, parseAmount, PAYMENT_METHODS } from '@/lib/format';
import { colors, font, STATUS } from '@/lib/theme';
import type { Booking, BookingStatus, Organization, Yacht } from '@/types/models';

type CreatableStatus = Extract<BookingStatus, 'option' | 'hold' | 'down_payment' | 'paid' | 'blocked'>;

export interface BookingFormProps {
  mode: 'create' | 'edit';
  org: Organization;
  yachts: Yacht[];
  initial?: Booking;
  defaults?: { yachtId?: string; start?: string; status?: CreatableStatus };
  canBlock: boolean;
  canRecordPayment: boolean;
  submitting: boolean;
  onSubmit: (input: BookingInput, payment: PaymentInput | null) => void;
}

const WALL_FMT = "yyyy-MM-dd'T'HH:mm";
export const toWallParam = (d: Date) => format(d, WALL_FMT);

export function BookingForm({ mode, org, yachts, initial, defaults, canBlock, canRecordPayment, submitting, onSubmit }: BookingFormProps) {
  const tz = org.timezone;
  const initialStart = useMemo(() => {
    if (initial) return toWall(initial.starts_at, tz);
    if (defaults?.start) return parse(defaults.start, WALL_FMT, new Date());
    const t = nowWall(tz);
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    return t;
  }, [initial, defaults?.start, tz]);

  const [yachtId, setYachtId] = useState(initial?.yacht_id ?? defaults?.yachtId ?? yachts[0]?.id ?? '');
  const [status, setStatus] = useState<CreatableStatus>(
    (initial?.status as CreatableStatus) ?? defaults?.status ?? 'option',
  );
  const [customerName, setCustomerName] = useState(initial?.customer_name ?? '');
  const [phone, setPhone] = useState(initial?.customer_phone ?? '');
  const [email, setEmail] = useState(initial?.customer_email ?? '');
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initial ? toWall(initial.ends_at, tz) : addHours(initialStart, 4));
  const [pickup, setPickup] = useState(initial?.pickup_location ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [passengers, setPassengers] = useState(initial?.passengers ? String(initial.passengers) : '');
  const [total, setTotal] = useState(initial?.total_price ? String(initial.total_price) : '');
  const [deposit, setDeposit] = useState(initial?.deposit_amount ? String(initial.deposit_amount) : '');
  const defaultExpiry = (s: CreatableStatus) =>
    addHours(nowWall(tz), s === 'hold' ? org.hold_default_hours : org.option_default_hours);
  const [expires, setExpires] = useState(initial?.expires_at ? toWall(initial.expires_at, tz) : defaultExpiry(status));
  const [expiryTouched, setExpiryTouched] = useState(!!initial?.expires_at);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [blockReason, setBlockReason] = useState(initial?.block_reason ?? 'Maintenance');
  // initial payment (create only)
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payDate, setPayDate] = useState(nowWall(tz));
  const [payRef, setPayRef] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const yacht = yachts.find((y) => y.id === yachtId);
  const isBlock = status === 'blocked';
  const needsExpiry = status === 'option' || status === 'hold';
  const takesPayment = mode === 'create' && canRecordPayment && (status === 'down_payment' || status === 'paid');
  const totalN = parseAmount(total);
  const depositN = parseAmount(deposit);
  const remaining = Math.max(totalN - (initial?.amount_paid ?? 0) - (takesPayment ? parseAmount(payAmount) : 0), 0);

  const changeStatus = (s: CreatableStatus) => {
    setStatus(s);
    if (!expiryTouched) setExpires(defaultExpiry(s));
    if (mode === 'create' && !payAmount) {
      if (s === 'down_payment' && depositN) setPayAmount(String(depositN));
      if (s === 'paid' && totalN) setPayAmount(String(totalN));
    }
  };

  const statusOptions = (['option', 'hold', 'down_payment', 'paid', 'blocked'] as CreatableStatus[]).map((s) => ({
    value: s,
    label: STATUS[s].label,
    color: STATUS[s].color,
    disabled: s === 'blocked' && !canBlock,
  }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!yachtId) e.yacht = 'Choose a yacht';
    if (!isBlock && !customerName.trim()) e.customerName = 'Customer name is required';
    if (end <= start) e.end = 'End must be after start';
    const pax = passengers ? Number(passengers) : null;
    if (pax !== null && (!Number.isInteger(pax) || pax < 1)) e.passengers = 'Enter a valid number';
    else if (pax && yacht && pax > yacht.capacity) e.passengers = `${yacht.name} carries max ${yacht.capacity}`;
    if (needsExpiry && expires <= nowWall(tz)) e.expires = 'Expiry must be in the future';
    if (needsExpiry && expires > end) e.expires = 'Expiry should be before the charter ends';
    if (depositN > totalN && totalN > 0) e.deposit = 'Deposit exceeds total';
    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = 'Invalid email';
    if (takesPayment && status === 'paid' && totalN <= 0) e.total = 'Enter the charter price';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    const amount = takesPayment ? parseAmount(payAmount) : 0;
    // With a real payment, the ledger moves the booking to DP/PAID server-side.
    const effectiveStatus: BookingStatus = amount > 0 ? 'hold' : status;
    const input: BookingInput = {
      yacht_id: yachtId,
      status: effectiveStatus,
      customer_name: isBlock ? null : customerName.trim(),
      customer_phone: isBlock ? null : phone.trim() || null,
      customer_email: isBlock ? null : email.trim() || null,
      starts_at: fromWall(start, tz).toISOString(),
      ends_at: fromWall(end, tz).toISOString(),
      pickup_location: isBlock ? null : pickup.trim() || null,
      destination: isBlock ? null : destination.trim() || null,
      passengers: isBlock || !passengers ? null : Number(passengers),
      total_price: isBlock ? 0 : totalN,
      deposit_amount: isBlock ? 0 : depositN,
      expires_at: needsExpiry ? fromWall(expires, tz).toISOString() : null,
      notes: notes.trim() || null,
      block_reason: isBlock ? blockReason.trim() || 'Blocked' : null,
    };
    if (mode === 'edit') delete (input as Partial<BookingInput>).status;
    const payment: PaymentInput | null =
      amount > 0
        ? { amount, method: payMethod, paid_at: fromWall(payDate, tz).toISOString(), reference: payRef.trim() || null }
        : null;
    onSubmit(input, payment);
  };

  return (
    <View>
      <OptionPicker
        label="Yacht"
        value={yachtId}
        onChange={setYachtId}
        options={yachts.map((y) => ({ value: y.id, label: y.name }))}
        hint={errors.yacht ?? (yacht ? `${yacht.yacht_type} · max ${yacht.capacity} guests` : undefined)}
      />

      {mode === 'create' && (
        <OptionPicker
          label="Status"
          value={status}
          onChange={changeStatus}
          options={statusOptions}
          hint={STATUS_HINT[status]}
        />
      )}

      {isBlock ? (
        <TextField label="Reason" value={blockReason} onChangeText={setBlockReason} placeholder="Maintenance, private use, dry dock…" />
      ) : (
        <>
          <TextField label="Customer name" value={customerName} onChangeText={setCustomerName} error={errors.customerName} placeholder="Full name or company" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+62…" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Passengers" value={passengers} onChangeText={setPassengers} keyboardType="number-pad" error={errors.passengers} placeholder={yacht ? `≤ ${yacht.capacity}` : ''} />
            </View>
          </View>
          <TextField label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
        </>
      )}

      <DateTimeField label={`Start (${tz})`} value={start} onChange={(d) => {
        const dur = end.getTime() - start.getTime();
        setStart(d);
        setEnd(new Date(d.getTime() + (dur > 0 ? dur : 4 * 3600_000)));
      }} />
      <DateTimeField label="End" value={end} onChange={setEnd} error={errors.end} hint={start.toDateString() !== end.toDateString() ? 'Multi-day charter' : undefined} />

      {needsExpiry && (
        <DateTimeField
          label={`${STATUS[status].label} expires`}
          value={expires}
          onChange={(d) => {
            setExpires(d);
            setExpiryTouched(true);
          }}
          error={errors.expires}
          hint="Released automatically back to Available at this time."
        />
      )}

      {!isBlock && (
        <>
          <TextField label="Pickup location" value={pickup} onChangeText={setPickup} placeholder="Marina / dock" />
          <TextField label="Destination" value={destination} onChangeText={setDestination} placeholder="Island, route, or itinerary" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextField label={`Total price (${org.currency})`} value={total} onChangeText={setTotal} keyboardType="decimal-pad" error={errors.total} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Deposit required" value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" error={errors.deposit} />
            </View>
          </View>
        </>
      )}

      {takesPayment && (
        <Card style={{ marginBottom: 16, backgroundColor: STATUS[status].soft, borderColor: STATUS[status].soft }}>
          <Text style={[font.h3, { marginBottom: 10 }]}>{status === 'paid' ? 'Full payment received' : 'Deposit received'}</Text>
          <TextField label="Amount" value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" />
          <OptionPicker label="Method" value={payMethod} onChange={setPayMethod} options={PAYMENT_METHODS} />
          <DateTimeField label="Payment date" value={payDate} onChange={setPayDate} mode="date" />
          <TextField label="Reference" value={payRef} onChangeText={setPayRef} placeholder="Transfer ID / receipt no." />
          <Text style={font.small}>Recorded in the payment ledger. Remaining balance: {money(remaining, org.currency)}</Text>
        </Card>
      )}

      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Catering, requests, broker info…" />

      {!isBlock && totalN > 0 && mode === 'edit' && (
        <Text style={[font.small, { marginBottom: 12 }]}>
          Paid so far {money(initial?.amount_paid ?? 0, org.currency)} · Remaining {money(remaining, org.currency)}
        </Text>
      )}

      <Button
        title={mode === 'create' ? (isBlock ? 'Block dates' : 'Create booking') : 'Save changes'}
        onPress={submit}
        loading={submitting}
        icon={mode === 'create' ? 'checkmark-circle-outline' : 'save-outline'}
      />
      {Object.keys(errors).length > 0 && (
        <Text style={{ color: colors.danger, marginTop: 10, textAlign: 'center' }}>Please fix the highlighted fields.</Text>
      )}
    </View>
  );
}

const STATUS_HINT: Record<CreatableStatus, string> = {
  option: 'Customer is interested. Expires automatically unless converted.',
  hold: 'Reserved. Blocks other confirmed bookings until it expires.',
  down_payment: 'Deposit paid — confirmed booking.',
  paid: 'Fully paid — confirmed booking.',
  blocked: 'Owner block: maintenance, private use, or unavailable.',
};
