import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { updateProfile } from '@/api/workspace';
import { Button, OptionPicker, Screen, Section, TextField } from '@/components/ui';
import { showError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, font } from '@/lib/theme';
import type { AccountType } from '@/types/models';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkspace } from '@/providers/WorkspaceProvider';

export default function EditProfile() {
  const { user } = useAuth();
  const { profile } = useWorkspace();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [company, setCompany] = useState(profile?.company_name ?? '');
  const [accountType, setAccountType] = useState<AccountType>(profile?.account_type ?? 'yacht_owner');
  const [password, setPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updateProfile(user!.id, {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        company_name: company.trim() || null,
        account_type: accountType,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      router.back();
    },
    onError: (e) => showError(e),
  });

  const changePassword = async () => {
    if (password.length < 8) return setPwMsg('At least 8 characters');
    const { error } = await supabase.auth.updateUser({ password });
    setPwMsg(error ? error.message : 'Password updated.');
    if (!error) setPassword('');
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label="Full name" value={fullName} onChangeText={setFullName} />
      <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Company (optional)" value={company} onChangeText={setCompany} />
      <OptionPicker
        label="Account type"
        value={accountType}
        onChange={setAccountType}
        options={[
          { value: 'yacht_owner', label: 'Yacht owner' },
          { value: 'fleet_manager', label: 'Fleet / charter manager' },
        ]}
      />
      <Button title="Save profile" onPress={() => save.mutate()} loading={save.isPending} />

      <Section title="Security">
        <Text style={[font.small, { marginBottom: 12 }]}>Signed in as {user?.email}</Text>
        <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        {pwMsg && <Text style={{ color: pwMsg.includes('updated') ? colors.success : colors.danger, marginBottom: 12 }}>{pwMsg}</Text>}
        <Button title="Change password" variant="secondary" onPress={changePassword} />
      </Section>
    </Screen>
  );
}
