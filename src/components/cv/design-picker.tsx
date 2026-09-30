import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { cvDesigns, type CvDesign } from '@/lib/cv';

const KEY = 'vc-cv-design';

// The CV and letter design the person last picked, remembered on the phone.
export function useCvDesign() {
  const [design, setDesignState] = useState<CvDesign>('blue');
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (cvDesigns.some((d) => d.id === saved)) setDesignState(saved as CvDesign);
      })
      .catch(() => {});
  }, []);
  const setDesign = (next: CvDesign) => {
    setDesignState(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  };
  return [design, setDesign] as const;
}

// Three small page sketches to choose the PDF design from.
export function CvDesignPicker({ design, onChange }: { design: CvDesign; onChange: (design: CvDesign) => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Design</Text>
      <View style={styles.row}>
        {cvDesigns.map((option) => {
          const chosen = option.id === design;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              accessibilityLabel={`${option.label}: ${option.note}`}
              style={[styles.option, chosen && styles.chosen]}>
              <Sketch design={option.id} />
              <Text style={[styles.name, chosen && styles.chosenText]}>{option.label}</Text>
              <Text style={styles.note} numberOfLines={2}>
                {option.note}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Sketch({ design }: { design: CvDesign }) {
  const line = (width: `${number}%`, color = '#CBD5E1') => <View style={[styles.line, { width, backgroundColor: color }]} />;
  if (design === 'modern') {
    return (
      <View style={[styles.page, styles.pageRow]}>
        <View style={styles.side}>
          {line('80%', '#94A3B8')}
          {line('60%', '#94A3B8')}
          {line('70%', '#94A3B8')}
        </View>
        <View style={styles.main}>
          {line('90%', '#0B1E5B')}
          {line('50%', '#1E5EFF')}
          {line('100%')}
          {line('85%')}
          {line('95%')}
        </View>
      </View>
    );
  }
  const heading = design === 'classic' ? '#111827' : '#1E5EFF';
  return (
    <View style={[styles.page, design === 'classic' && styles.center]}>
      {line('70%', design === 'classic' ? '#111827' : '#0B1E5B')}
      {line('45%')}
      <View style={[styles.rule, { backgroundColor: heading }]} />
      {line('100%')}
      {line('85%')}
      <View style={[styles.rule, { backgroundColor: heading }]} />
      {line('95%')}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '700', color: Colors.text },
  row: { flexDirection: 'row', gap: Spacing.sm },
  option: { flex: 1, alignItems: 'center', gap: 4, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  chosen: { borderColor: Colors.primary, borderWidth: 2, backgroundColor: '#EFF4FF' },
  name: { fontSize: 13, fontWeight: '700', color: Colors.text },
  chosenText: { color: Colors.primary },
  note: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  page: { width: 56, height: 74, borderRadius: 3, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#FFFFFF', padding: 5, gap: 4, overflow: 'hidden' },
  pageRow: { flexDirection: 'row', padding: 0, gap: 0 },
  center: { alignItems: 'center' },
  side: { width: 18, backgroundColor: '#0B1E5B', padding: 3, gap: 4 },
  main: { flex: 1, padding: 4, gap: 4 },
  line: { height: 3, borderRadius: 2 },
  rule: { height: 1, width: '100%' },
});
