import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import type { IconName } from '@/components/ui';
import { colors } from '@/lib/theme';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Dashboard', icon: 'grid-outline', iconActive: 'grid' },
  { name: 'calendar', title: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'yachts', title: 'Yachts', icon: 'boat-outline', iconActive: 'boat' },
  { name: 'bookings', title: 'Bookings', icon: 'list-outline', iconActive: 'list' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentDark,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} color={color as string} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
