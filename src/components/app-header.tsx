import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export function AppHeader({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.logo}>
        <Ionicons name="desktop" size={18} color={Colors.onDark} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Ionicons name="notifications-outline" size={22} color={Colors.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
});
