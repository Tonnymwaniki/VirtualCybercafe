import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatKsh, statusLabel, type PrintJob } from '@/lib/print-types';

const statusColor: Record<PrintJob['status'], string> = {
  sent: Colors.primary,
  printing: Colors.warning,
  ready: Colors.success,
  collected: Colors.textMuted,
  cancelled: Colors.textMuted,
};

export function describeOptions(job: Pick<PrintJob, 'pages' | 'copies' | 'colour' | 'doubleSided'>) {
  return [
    `${job.pages} page${job.pages === 1 ? '' : 's'}`,
    `${job.copies} cop${job.copies === 1 ? 'y' : 'ies'}`,
    job.colour ? 'colour' : 'black and white',
    job.doubleSided ? 'both sides' : 'one side',
  ].join(' · ');
}

export function JobRow({ job, subtitle, onPress }: { job: PrintJob; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.dim]}>
      <View style={styles.text}>
        <View style={styles.top}>
          <Text style={styles.code}>{job.code}</Text>
          <Text style={[styles.status, { color: statusColor[job.status] }]}>{statusLabel[job.status]}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {job.fileName}
        </Text>
        <Text style={styles.muted}>{subtitle ?? describeOptions(job)}</Text>
        <Text style={styles.muted}>{formatKsh(job.price)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  text: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 16, fontWeight: '700', color: Colors.navy, letterSpacing: 1 },
  status: { fontSize: 12, fontWeight: '700' },
  name: { fontSize: 14, color: Colors.text },
  muted: { fontSize: 12, color: Colors.textMuted },
  dim: { opacity: 0.7 },
});
