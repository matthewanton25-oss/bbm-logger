import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Loading } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, font } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  // Refetch stale data when the app returns to the foreground.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
    return () => sub.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, initializing } = useAuth();
  if (!isSupabaseConfigured) return <SetupRequired />;
  if (initializing) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="auth-callback" />
    </Stack>
  );
}

function SetupRequired() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 28, backgroundColor: colors.bg }}>
      <Text style={font.h2}>Connect your backend</Text>
      <Text style={[font.body, { marginTop: 12, color: colors.muted }]}>
        Copy mobile/.env.example to mobile/.env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY,
        then restart Expo. See yacht-booking/README.md.
      </Text>
    </View>
  );
}
