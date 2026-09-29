import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { useLanguage, type Language } from '@/lib/i18n';

const options: { id: Language; label: string; name: string }[] = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'sw', label: 'SW', name: 'Kiswahili' },
];

// English / Kiswahili switch for the app's own words.
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="radio"
          accessibilityLabel={option.name}
          accessibilityState={{ checked: language === option.id }}
          onPress={() => setLanguage(option.id)}
          style={[styles.option, language === option.id && styles.active]}>
          <Text style={[styles.label, language === option.id && styles.activeLabel]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, padding: 2 },
  option: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  active: { backgroundColor: Colors.navy },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  activeLabel: { color: Colors.onDark },
});
