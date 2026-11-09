import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { colors } from '@/lib/theme';

export function BrandMark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="boat" size={24} color={colors.accent} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.navy, letterSpacing: -0.5 }}>
        Yacht<Text style={{ color: colors.accent }}>Ops</Text>
      </Text>
    </View>
  );
}
