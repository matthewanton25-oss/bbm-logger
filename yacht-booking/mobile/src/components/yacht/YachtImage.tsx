import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/lib/theme';

/** Yacht photo with an on-brand placeholder when missing or failing to load. */
export function YachtImage({ uri, style, iconSize = 34 }: { uri?: string | null; style?: StyleProp<ViewStyle>; iconSize?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[{ backgroundColor: colors.navySoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {!uri || failed ? (
        <Ionicons name="boat" size={iconSize} color={colors.accent} />
      ) : (
        <Image
          source={{ uri }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
          transition={200}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
