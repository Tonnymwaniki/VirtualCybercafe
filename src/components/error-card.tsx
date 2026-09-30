import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/lib/i18n';
import type { Explained } from '@/lib/workbench/explain';

// An error explained: what went wrong, why, and what to do next, with an
// optional Try again and the technical detail folded away.
// Trying again only helps when the cause may pass (connection, server, memory).
const RETRY_HELPS: Explained['kind'][] = ['network', 'timeout', 'server', 'unknown', 'too_big'];

export function ErrorCard({ error, onRetry }: { error: Explained; onRetry?: () => void }) {
  // After a failed pick, "try again" would redo the last job with the old file.
  const retry = RETRY_HELPS.includes(error.kind) && !error.task.startsWith('open') ? onRetry : undefined;
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.head}>
        <Ionicons name="alert-circle" size={22} color="#DC2626" />
        <Text style={styles.title}>{error.title}</Text>
      </View>
      <Text style={styles.label}>{t('err.whyLabel')}</Text>
      <Text style={styles.text}>{error.why}</Text>
      {error.steps.length > 0 && (
        <>
          <Text style={styles.label}>{t('err.stepsLabel')}</Text>
          {error.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.number}>{i + 1}</Text>
              <Text style={[styles.text, styles.flex]}>{step}</Text>
            </View>
          ))}
        </>
      )}
      <View style={styles.footer}>
        {retry && (
          <Pressable onPress={retry} accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && styles.dim]}>
            <Ionicons name="refresh" size={16} color={Colors.onDark} />
            <Text style={styles.retryText}>{t('err.retry')}</Text>
          </Pressable>
        )}
        {!!error.detail && (
          <Pressable onPress={() => setOpen(!open)} hitSlop={6}>
            <Text style={styles.more}>
              {t('err.details')} {open ? '▴' : '▾'}
            </Text>
          </Pressable>
        )}
      </View>
      {open && (
        <Text style={styles.detail} selectable>
          {error.detail}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#991B1B' },
  label: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#991B1B', textTransform: 'uppercase', letterSpacing: 0.5 },
  text: { fontSize: 14, lineHeight: 20, color: Colors.text },
  step: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  number: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FECACA', color: '#991B1B', fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 20, overflow: 'hidden' },
  flex: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 6 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  retryText: { color: Colors.onDark, fontWeight: '700', fontSize: 14 },
  more: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  detail: { fontSize: 12, color: Colors.textMuted, fontFamily: 'monospace' },
  dim: { opacity: 0.6 },
});
