import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, font } from '@/lib/theme';

/** Reached from the password-recovery email (recovery session is active). */
export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 8) return setError('At least 8 characters');
    if (password !== confirm) return setError("Passwords don't match");
    setLoading(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (e) return setError(e.message);
    router.replace('/');
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={[font.body, { color: colors.muted, marginBottom: 20 }]}>Choose a new password for your account.</Text>
      <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry error={error ?? undefined} />
      <Button title="Update password" onPress={submit} loading={loading} />
    </Screen>
  );
}
