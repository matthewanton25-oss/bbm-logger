import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, font } from '@/lib/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email');
    setLoading(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: Linking.createURL('auth-callback', { queryParams: { next: 'reset-password' } }),
    });
    setLoading(false);
    if (e) setError(e.message);
    else setSent(true);
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={font.h1}>Reset password</Text>
      <Text style={[font.body, { color: colors.muted, marginTop: 6, marginBottom: 24 }]}>
        Enter your account email and we'll send a secure reset link.
      </Text>
      {sent ? (
        <Text style={[font.body, { color: colors.success }]}>
          Check your inbox — if an account exists for {email}, a reset link is on its way.
        </Text>
      ) : (
        <>
          <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error ?? undefined} />
          <Button title="Send reset link" onPress={submit} loading={loading} />
        </>
      )}
    </Screen>
  );
}
