import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLanguage, type Language } from '@/lib/i18n';

const options: { id: Language | 'sheng'; name: string; note?: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'sw', name: 'Kiswahili' },
  { id: 'sheng', name: 'Sheng', note: 'Coming soon' },
];

// Language button, like other apps: shows the current language and opens a
// list to change it. English is the default until the person picks another.
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.id === language)?.name ?? 'English';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Language: ${current}. Change language`}
        style={({ pressed }) => [styles.button, pressed && styles.dim]}>
        <Ionicons name="globe-outline" size={15} color={Colors.text} />
        <Text style={styles.buttonText}>{current}</Text>
        <Ionicons name="chevron-down" size={13} color={Colors.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>Language</Text>
            {options.map((option) => {
              const ready = option.id !== 'sheng';
              const chosen = option.id === language;
              return (
                <Pressable
                  key={option.id}
                  disabled={!ready}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: chosen, disabled: !ready }}
                  onPress={() => {
                    setLanguage(option.id as Language);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.option, chosen && styles.chosen, pressed && styles.dim]}>
                  <Text style={[styles.name, !ready && styles.muted]}>{option.name}</Text>
                  {option.note && <Text style={styles.muted}>{option.note}</Text>}
                  {chosen && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, paddingHorizontal: 10, paddingVertical: 5 },
  buttonText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs, width: '100%', maxWidth: 360, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  chosen: { backgroundColor: Colors.background },
  name: { flex: 1, fontSize: 15, color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted },
  dim: { opacity: 0.6 },
});
