import { Stack } from 'expo-router';

import { NoWorkspace } from '@/components/NoWorkspace';
import { Loading } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useWorkspace, WorkspaceProvider } from '@/providers/WorkspaceProvider';

export default function AppLayout() {
  return (
    <WorkspaceProvider>
      <AppStack />
    </WorkspaceProvider>
  );
}

function AppStack() {
  const ws = useWorkspace();
  if (ws.loading) return <Loading />;
  if (!ws.org) return <NoWorkspace />;
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.navy,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '700', color: colors.navy },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="booking/new" options={{ title: 'New booking', presentation: 'modal' }} />
      <Stack.Screen name="booking/[id]" options={{ title: 'Booking' }} />
      <Stack.Screen name="booking/edit/[id]" options={{ title: 'Edit booking' }} />
      <Stack.Screen name="booking/payment/[id]" options={{ title: 'Record payment', presentation: 'modal' }} />
      <Stack.Screen name="yacht/new" options={{ title: 'Add yacht', presentation: 'modal' }} />
      <Stack.Screen name="yacht/[id]" options={{ title: '' }} />
      <Stack.Screen name="yacht/edit/[id]" options={{ title: 'Edit yacht' }} />
      <Stack.Screen name="team" options={{ title: 'Team & permissions' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="settings/notifications" options={{ title: 'Notification settings' }} />
      <Stack.Screen name="settings/workspace" options={{ title: 'Workspace settings' }} />
      <Stack.Screen name="settings/profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
    </Stack>
  );
}
