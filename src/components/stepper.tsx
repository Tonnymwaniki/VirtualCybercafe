import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/lib/i18n';

type StepperProps = { names: string[]; step: number; onStep: (step: number) => void };

// One step at a time: "Step 2 of 5", the step's name, a progress bar, and a
// dot per step to jump around.
export function StepHeader({ names, step, onStep }: StepperProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.count}>{t('step.of', { n: step + 1, total: names.length })}</Text>
        <View style={styles.dots}>
          {names.map((name, index) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}. ${name}`}
              hitSlop={6}
              onPress={() => onStep(index)}
              style={[styles.dot, index <= step && styles.dotDone, index === step && styles.dotCurrent]}
            />
          ))}
        </View>
      </View>
      <Text style={styles.name}>{names[step]}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${((step + 1) / names.length) * 100}%` }]} />
      </View>
    </View>
  );
}

export function StepFooter({ names, step, onStep }: StepperProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.footer}>
      {step > 0 && (
        <Pressable onPress={() => onStep(step - 1)} style={({ pressed }) => [styles.back, pressed && styles.dim]}>
          <Text style={styles.backText}>{t('step.back')}</Text>
        </Pressable>
      )}
      {step < names.length - 1 && (
        <Pressable onPress={() => onStep(step + 1)} style={({ pressed }) => [styles.next, pressed && styles.dim]}>
          <Text style={styles.nextText} numberOfLines={1}>
            {t('step.next', { name: names[step + 1] })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  dots: { flexDirection: 'row', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: Radius.pill, backgroundColor: Colors.border },
  dotDone: { backgroundColor: Colors.primary },
  dotCurrent: { backgroundColor: Colors.navy, width: 22 },
  name: { fontSize: 20, fontWeight: '700', color: Colors.navy },
  track: { height: 6, borderRadius: Radius.pill, backgroundColor: Colors.border, overflow: 'hidden', marginTop: Spacing.xs },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.pill },
  footer: { flexDirection: 'row', gap: Spacing.md, alignSelf: 'stretch' },
  back: {
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
  },
  backText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  next: { flex: 1, alignItems: 'center', backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: Spacing.md },
  nextText: { fontSize: 15, fontWeight: '600', color: Colors.onDark },
  dim: { opacity: 0.7 },
});
