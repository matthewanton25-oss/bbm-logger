import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Loading } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, font } from '@/lib/theme';

/**
 * Deep-link target for email verification, password recovery and team invites.
 * Supports PKCE (?code=…) and implicit (#access_token=…) links.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; next?: string; error_description?: string }>();
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(params.error_description ?? null);

  useEffect(() => {
    let done = false;
    (async () => {
      try {
        if (params.code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(params.code);
          if (e) throw e;
        } else if (url?.includes('#')) {
          const hash = new URLSearchParams(url.split('#')[1]);
          const access_token = hash.get('access_token');
          const refresh_token = hash.get('refresh_token');
          if (access_token && refresh_token) {
            const { error: e } = await supabase.auth.setSession({ access_token, refresh_token });
            if (e) throw e;
          }
          if (hash.get('type') === 'recovery') return void router.replace('/reset-password');
        }
        if (done) return;
        router.replace(params.next === 'reset-password' ? '/reset-password' : '/');
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      done = true;
    };
  }, [params.code, params.next, url]);

  if (!error) return <Loading />;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 28, backgroundColor: colors.bg }}>
      <Text style={font.h2}>Link expired</Text>
      <Text style={[font.body, { color: colors.muted, marginVertical: 12 }]}>{error}</Text>
      <Button title="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </View>
  );
}
