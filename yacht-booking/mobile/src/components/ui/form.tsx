import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, font, radius } from '@/lib/theme';
import { Chip } from './primitives';

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[font.label, { marginBottom: 6 }]}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={[font.tiny, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} error={error} hint={hint}>
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          props.multiline && { height: 96, paddingTop: 12, textAlignVertical: 'top' },
          focused && { borderColor: colors.accent, backgroundColor: colors.white },
          !!error && { borderColor: colors.danger },
          style,
        ]}
      />
    </Field>
  );
}

export function OptionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; color?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options
          .filter((o) => !o.disabled)
          .map((o) => (
            <Chip key={o.value} label={o.label} color={o.color} active={value === o.value} onPress={() => onChange(o.value)} />
          ))}
      </View>
    </Field>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[font.body, { fontWeight: '500' }]}>{label}</Text>
        {description && <Text style={font.small}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.white}
      />
    </View>
  );
}

/**
 * Date + time picker operating on WALL-clock dates (see lib/datetime.ts).
 * iOS: inline compact pickers. Android: native dialogs (date, then time).
 */
export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  minimumDate,
  error,
  hint,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  mode?: 'date' | 'datetime';
  minimumDate?: Date;
  error?: string;
  hint?: string;
}) {
  if (Platform.OS === 'ios') {
    const handle = (_: DateTimePickerEvent, d?: Date) => d && onChange(d);
    return (
      <Field label={label} error={error} hint={hint}>
        <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 4 }]}>
          <DateTimePicker value={value} mode={mode} display="compact" onChange={handle} minimumDate={minimumDate} minuteInterval={5} accentColor={colors.accent} />
        </View>
      </Field>
    );
  }

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      onChange: (e, date) => {
        if (e.type !== 'set' || !date) return;
        const merged = new Date(value);
        merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        if (mode === 'date') return onChange(merged);
        DateTimePickerAndroid.open({
          value: merged,
          mode: 'time',
          is24Hour: true,
          onChange: (e2, time) => {
            if (e2.type !== 'set' || !time) return onChange(merged);
            const final = new Date(merged);
            final.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(final);
          },
        });
      },
    });
  };

  return (
    <Field label={label} error={error} hint={hint}>
      <Pressable onPress={openAndroid} style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={font.body}>{format(value, mode === 'date' ? 'EEE d MMM yyyy' : 'EEE d MMM yyyy · HH:mm')}</Text>
      </Pressable>
    </Field>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    justifyContent: 'center',
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
});
