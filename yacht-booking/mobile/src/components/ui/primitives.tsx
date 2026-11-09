import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, font, radius, shadow } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'navy';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} />}
          <Text style={[styles.btnText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.white, border: colors.accent },
  navy: { bg: colors.navy, fg: colors.white, border: colors.navy },
  secondary: { bg: colors.white, fg: colors.navy, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.accentDark, border: 'transparent' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
};

export function IconButton({
  icon,
  onPress,
  color = colors.navy,
  size = 22,
  badge,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  badge?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.iconBtn} accessibilityLabel={accessibilityLabel}>
      <Ionicons name={icon} size={size} color={color} />
      {!!badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Fab({ icon = 'add', onPress, label }: { icon?: IconName; onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}>
      <Ionicons name={icon} size={24} color={colors.white} />
      {label && <Text style={styles.fabText}>{label}</Text>}
    </Pressable>
  );
}

// ---------------------------------------------------------------- Layout
export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <View style={styles.sectionHead}>
        <Text style={font.h3}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function InfoRow({ icon, label, value }: { icon?: IconName; label: string; value?: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.infoRow}>
      {icon && <Ionicons name={icon} size={18} color={colors.muted} style={{ width: 24 }} />}
      <Text style={[font.small, { flex: 1 }]}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={styles.infoValue} numberOfLines={3}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.surface }]}>
      {icon && (
        <View style={[styles.listIcon, danger && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.accentDark} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { fontWeight: '500' }, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle && <Text style={font.small}>{subtitle}</Text>}
      </View>
      {right ?? (onPress && <Ionicons name="chevron-forward" size={18} color={colors.faint} />)}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.navy, borderColor: colors.navy }]}
    >
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
      {children}
    </ScrollView>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === o.value && { color: colors.navy }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  children,
}: {
  icon: IconName;
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.accent} />
      </View>
      <Text style={[font.h3, { textAlign: 'center' }]}>{title}</Text>
      {message && <Text style={[font.small, { textAlign: 'center', marginTop: 6 }]}>{message}</Text>}
      {children && <View style={{ marginTop: 18, gap: 10, alignSelf: 'stretch' }}>{children}</View>}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 }} />;
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSmall: { height: 38, paddingHorizontal: 12, borderRadius: radius.sm },
  btnText: { fontSize: 16, fontWeight: '600' },
  iconBtn: { padding: 6 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    height: 56,
    minWidth: 56,
    paddingHorizontal: 16,
    borderRadius: 28,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadow,
    shadowOpacity: 0.2,
    elevation: 6,
  },
  fabText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border, ...shadow },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 6 },
  infoValue: { ...font.body, fontWeight: '500', textAlign: 'right', flexShrink: 1, maxWidth: '62%' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.navySoft },
  dot: { width: 8, height: 8, borderRadius: 4 },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.white, ...shadow },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  empty: { alignItems: 'center', padding: 32 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
});
