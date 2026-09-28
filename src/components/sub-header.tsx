import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

// Title row with a back arrow, for screens opened on top of the tabs.
export function SubHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <Ionicons name="arrow-back" size={22} color={Colors.text} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.text },
});
