import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

// Title row with a back arrow, for screens opened on top of the tabs. The
// help button opens the attendant, told which screen the user is on.
export function SubHeader({ title, help = true }: { title: string; help?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <Ionicons name="arrow-back" size={22} color={Colors.text} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      {help && (
        <Pressable
          accessibilityLabel="Help me here"
          hitSlop={8}
          onPress={() => router.push({ pathname: '/chat', params: { from: pathname } })}
          style={({ pressed }) => [styles.help, pressed && styles.dim]}>
          <Ionicons name="help-circle" size={18} color={Colors.primary} />
          <Text style={styles.helpText}>Help</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.text },
  help: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  helpText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  dim: { opacity: 0.7 },
});
