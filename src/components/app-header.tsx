import { StyleSheet, Text, View } from 'react-native';

import { LanguageToggle } from '@/components/language-toggle';
import { Mascot } from '@/components/mascot';
import { Colors, Spacing } from '@/constants/theme';

// The tab screens' header: the mascot, the title and the language switch.
export function AppHeader({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <Mascot size={32} />
      <Text style={styles.title}>{title}</Text>
      <LanguageToggle />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
});
