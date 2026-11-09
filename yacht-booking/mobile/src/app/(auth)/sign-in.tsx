import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, font } from '@/lib/theme';
import { BrandMark } from '@/components/BrandMark';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const signIn = async () => {
    setError(null);
    setUnconfirmed(false);
    if (!email || !password) return setError('Enter your email and password.');
    setLoading(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (e) {
      if (e.code === 'email_not_confirmed') setUnconfirmed(true);
      setError(e.code === 'invalid_credentials' ? 'Incorrect email or password.' : e.message);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <BrandMark />
      <Text style={[font.h1, { marginTop: 28 }]}>Welcome back</Text>
      <Text style={[font.body, { color: colors.muted, marginTop: 6, marginBottom: 28 }]}>
        Sign in to manage your fleet's availability.
      </Text>
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={signIn} />
      {error && <Text style={styles.error}>{error}</Text>}
      {unconfirmed && (
        <Button
          title="Resend verification email"
          variant="ghost"
          onPress={() => router.push({ pathname: '/verify-email', params: { email: email.trim() } })}
        />
      )}
      <Button title="Sign in" onPress={signIn} loading={loading} />
      <View style={styles.links}>
        <Link href="/forgot-password" style={styles.link}>
          Forgot password?
        </Link>
        <Link href="/sign-up" style={styles.link}>
          Create account
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, marginBottom: 12 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  link: { color: colors.accentDark, fontWeight: '600', fontSize: 15 },
});
