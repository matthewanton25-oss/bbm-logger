import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { YachtInput } from '@/api/yachts';
import { Button, Field, OptionPicker, TextField } from '@/components/ui';
import { YACHT_TYPES } from '@/lib/format';
import { colors, radius } from '@/lib/theme';
import type { Yacht, YachtPhoto } from '@/types/models';
import { YachtImage } from './YachtImage';

export interface LocalPhoto {
  key: string;
  uri: string;
  existing?: YachtPhoto;
}

export function YachtForm({
  initial,
  submitting,
  onSubmit,
}: {
  initial?: Yacht;
  submitting: boolean;
  onSubmit: (input: YachtInput, photos: { added: string[]; removed: YachtPhoto[] }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.yacht_type ?? 'Motor Yacht');
  const [length, setLength] = useState(initial?.length_m ? String(initial.length_m) : '');
  const [capacity, setCapacity] = useState(initial?.capacity ? String(initial.capacity) : '');
  const [marina, setMarina] = useState(initial?.home_marina ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [registration, setRegistration] = useState(initial?.registration_number ?? '');
  const [active, setActive] = useState<'active' | 'inactive'>(initial?.status === 'inactive' ? 'inactive' : 'active');
  const [photos, setPhotos] = useState<LocalPhoto[]>(
    (initial?.photos ?? []).map((p) => ({ key: p.id, uri: p.url, existing: p })),
  );
  const [removed, setRemoved] = useState<YachtPhoto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.75,
      selectionLimit: 10,
    });
    if (res.canceled) return;
    setPhotos((prev) => [...prev, ...res.assets.map((a) => ({ key: a.uri, uri: a.uri }))]);
  };

  const removePhoto = (p: LocalPhoto) => {
    setPhotos((prev) => prev.filter((x) => x.key !== p.key));
    if (p.existing) setRemoved((prev) => [...prev, p.existing!]);
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Yacht name is required';
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) e.capacity = 'Enter max passengers';
    const len = length ? Number(length.replace(',', '.')) : null;
    if (len !== null && (!Number.isFinite(len) || len <= 0)) e.length = 'Invalid length';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit(
      {
        name: name.trim(),
        yacht_type: type,
        length_m: len,
        capacity: cap,
        home_marina: marina.trim() || null,
        description: description.trim() || null,
        registration_number: registration.trim() || null,
        status: initial?.status === 'archived' ? 'archived' : active,
      },
      { added: photos.filter((p) => !p.existing).map((p) => p.uri), removed },
    );
  };

  return (
    <View>
      <Field label="Photos">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {photos.map((p, i) => (
            <View key={p.key}>
              <YachtImage uri={p.uri} style={styles.photo} />
              {i === 0 && <Text style={styles.cover}>Cover</Text>}
              <Pressable onPress={() => removePhoto(p)} style={styles.remove} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.white} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={pickPhotos} style={[styles.photo, styles.add]}>
            <Ionicons name="camera-outline" size={26} color={colors.accentDark} />
            <Text style={{ color: colors.accentDark, fontWeight: '600', marginTop: 4 }}>Add</Text>
          </Pressable>
        </ScrollView>
      </Field>

      <TextField label="Yacht name" value={name} onChangeText={setName} error={errors.name} placeholder="e.g. Azura" />
      <OptionPicker label="Type" value={type} onChange={setType} options={YACHT_TYPES.map((t) => ({ value: t, label: t }))} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Length (m)" value={length} onChangeText={setLength} keyboardType="decimal-pad" error={errors.length} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Max passengers" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" error={errors.capacity} />
        </View>
      </View>
      <TextField label="Home marina / location" value={marina} onChangeText={setMarina} placeholder="Marina Ancol, Jakarta" />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline />
      <TextField label="Registration number (optional)" value={registration} onChangeText={setRegistration} autoCapitalize="characters" />
      {initial?.status !== 'archived' && (
        <OptionPicker
          label="Status"
          value={active}
          onChange={setActive}
          options={[
            { value: 'active', label: 'Active', color: colors.success },
            { value: 'inactive', label: 'Inactive', color: colors.faint },
          ]}
          hint="Inactive yachts stay visible but can't take new bookings."
        />
      )}
      <Button title={initial ? 'Save yacht' : 'Add yacht'} onPress={submit} loading={submitting} icon="checkmark-circle-outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: 110, height: 84, borderRadius: radius.md },
  add: { backgroundColor: colors.accentSoft, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(11,31,58,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    backgroundColor: 'rgba(11,31,58,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
