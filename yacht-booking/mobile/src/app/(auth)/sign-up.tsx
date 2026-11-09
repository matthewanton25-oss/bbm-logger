import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Button, OptionPicker, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, font } from '@/lib/theme';
import type { AccountType } from '@/types/models';

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('yacht_owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Your name is required';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Enter a valid email';
    if (!phone.trim()) e.phone = 'Phone number is required';
    if (password.length < 8) e.password = 'At least 8 characters';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: Linking.createURL('auth-callback'),
        // Picked up by the handle_new_user() trigger to build profile + workspace.
        data: { full_name: fullName.trim(), company_name: company.trim(), phone: phone.trim(), account_type: accountType },
      },
    });
    setLoading(false);
    if (error) return setErrors({ form: error.message });
    // When email confirmation is disabled, Supabase signs the user in immediately.
    if (!data.session) router.replace({ pathname: '/verify-email', params: { email: email.trim().toLowerCase() } });
  };

  return (
    <Screen edges={['bottom']}>
      <BrandMark />
      <Text style={[font.h1, { marginTop: 24 }]}>Create your account</Text>
      <Text style={[font.body, { color: colors.muted, marginTop: 6, marginBottom: 24 }]}>
        Your private dashboard for yachts, availability and bookings.
      </Text>
      <OptionPicker
        label="I am a"
        value={accountType}
        onChange={setAccountType}
        options={[
          { value: 'yacht_owner', label: 'Yacht owner' },
          { value: 'fleet_manager', label: 'Fleet / charter manager' },
        ]}
      />
      <TextField label="Full name" value={fullName} onChangeText={setFullName} error={errors.fullName} autoComplete="name" />
      <TextField label="Company (optional)" value={company} onChangeText={setCompany} placeholder="Used as your workspace name" />
      <TextField label="Phone" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" />
      <TextField label="Email" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <TextField label="Password" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      {errors.form && <Text style={{ color: colors.danger, marginBottom: 12 }}>{errors.form}</Text>}
      <Button title="Create account" onPress={submit} loading={loading} />
      <Text style={[font.small, { textAlign: 'center', marginTop: 16 }]}>We'll email you a link to verify your address.</Text>
    </Screen>
  );
}
