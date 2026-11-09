import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { savePushToken } from '@/api/notifications';
import { colors } from '@/lib/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for Expo push notifications and routes taps to the booking.
 * Remote push needs a development/production build with an EAS projectId (not Expo Go).
 */
export function usePushRegistration(userId: string | null) {
  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    let cancelled = false;

    (async () => {
      try {
        if (!Device.isDevice) return;
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('bookings', {
            name: 'Bookings',
            importance: Notifications.AndroidImportance.HIGH,
            lightColor: colors.accent,
          });
        }
        const existing = await Notifications.getPermissionsAsync();
        let granted = existing.granted;
        if (!granted && existing.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
        if (!granted || cancelled) return;

        const projectId =
          (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ||
          Constants.easConfig?.projectId;
        if (!projectId) return;
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!cancelled) await savePushToken(userId, token, Platform.OS);
      } catch (e) {
        console.warn('Push registration skipped:', e);
      }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const bookingId = response.notification.request.content.data?.booking_id;
      if (typeof bookingId === 'string') router.push({ pathname: '/booking/[id]', params: { id: bookingId } });
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [userId]);
}
