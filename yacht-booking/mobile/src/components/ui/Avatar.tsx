import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { initials } from '@/lib/format';
import { colors } from '@/lib/theme';

export function Avatar({ url, name, size = 44 }: { url?: string | null; name?: string | null; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ color: colors.accentDark, fontWeight: '700', fontSize: size * 0.38 }}>{initials(name)}</Text>
      )}
    </View>
  );
}
