import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  size?: number;
};

// A rounded square in the item's colour with a white icon, as in the design.
export function IconBadge({ icon, color, size = 48 }: Props) {
  return (
    <View
      style={[styles.badge, { backgroundColor: color, width: size, height: size }]}>
      <Ionicons name={icon} size={size * 0.5} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
