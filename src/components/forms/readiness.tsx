import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Reasoning } from '@/lib/forms/reason';
import { useLanguage } from '@/lib/i18n';

export function ReadinessBar({ percent, ready }: { percent: number; ready: boolean }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: ready ? Colors.success : Colors.primary }]} />
    </View>
  );
}

// How ready the application is: the %, a tick or warning per section, and the
// one next thing to do.
export function ReadinessCard({ reasoning, onGo }: { reasoning: Reasoning; onGo: (fieldId: string) => void }) {
  const { t } = useLanguage();
  const { percent, ready, sections, next } = reasoning;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('forms.readiness')}</Text>
        <Text style={[styles.percent, ready && styles.good]}>{t('forms.percent', { n: percent })}</Text>
      </View>
      <ReadinessBar percent={percent} ready={ready} />
      <View style={styles.sections}>
        {sections
          .filter((s) => s.total > 0)
          .map((s) => {
            const complete = s.done === s.total;
            const problems = s.missing + s.invalid;
            return (
              <View key={s.id} style={styles.row}>
                <Ionicons name={complete ? 'checkmark-circle' : 'alert-circle'} size={18} color={complete ? Colors.success : Colors.warning} />
                <Text style={styles.rowTitle}>{s.title}</Text>
                <Text style={[styles.rowState, complete ? styles.good : styles.warn]}>
                  {complete ? t('forms.complete') : s.invalid ? t('forms.toFix', { n: problems }) : t('forms.missing', { n: problems })}
                </Text>
              </View>
            );
          })}
      </View>
      {next && (
        <Pressable onPress={() => onGo(next.fieldId)} style={({ pressed }) => [styles.next, pressed && styles.dim]}>
          <View style={styles.nextText}>
            <Text style={styles.nextLabel}>{t('forms.nextStep')}</Text>
            <Text style={styles.nextMessage}>{next.message}</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={26} color={Colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  percent: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  good: { color: Colors.success },
  warn: { color: Colors.warning },
  track: { height: 8, borderRadius: Radius.pill, backgroundColor: Colors.primarySoft, overflow: 'hidden' },
  fill: { height: 8, borderRadius: Radius.pill },
  sections: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowTitle: { flex: 1, fontSize: 14, color: Colors.text },
  rowState: { fontSize: 13, fontWeight: '600' },
  next: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primarySoft, borderRadius: Radius.md, padding: Spacing.md },
  nextText: { flex: 1, gap: 2 },
  nextLabel: { fontSize: 12, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },
  nextMessage: { fontSize: 14, lineHeight: 19, color: Colors.text },
  dim: { opacity: 0.6 },
});
