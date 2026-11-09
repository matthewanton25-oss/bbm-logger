import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, font } from '@/lib/theme';

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email ?? '',
      options: { emailRedirectTo: Linking.createURL('auth-callback') },
    });
    setLoading(false);
    setStatus(error ? error.message : 'Verification email sent again.');
  };

  return (
    <Screen edges={['bottom']} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="mail-unread-outline" size={34} color={colors.accentDark} />
        </View>
        <Text style={[font.h2, { marginTop: 20, textAlign: 'center' }]}>Verify your email</Text>
        <Text style={[font.body, { color: colors.muted, textAlign: 'center', marginTop: 10 }]}>
          We sent a verification link to{'\n'}
          <Text style={{ fontWeight: '700', color: colors.navy }}>{email}</Text>
          {'\n'}Open it on this device to activate your account.
        </Text>
      </View>
      <View style={{ marginTop: 32, gap: 10 }}>
        <Button title="Back to sign in" onPress={() => router.replace('/sign-in')} />
        <Button title="Resend email" variant="secondary" onPress={resend} loading={loading} />
        {status && <Text style={[font.small, { textAlign: 'center' }]}>{status}</Text>}
      </View>
    </Screen>
  );
}
