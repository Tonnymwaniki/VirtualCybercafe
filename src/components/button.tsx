import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  icon?: ComponentProps<typeof Ionicons>['name'];
  busy?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, busy, disabled }: Props) {
  const primary = variant === 'primary';
  const color = primary ? Colors.onDark : Colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        (pressed || disabled) && styles.dim,
      ]}>
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={color} />}
          <Text style={[styles.label, { color }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
  },
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.primary },
  label: { fontSize: 15, fontWeight: '600' },
  dim: { opacity: 0.6 },
});
