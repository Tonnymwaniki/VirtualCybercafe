import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card, LinkButton, Note, openUrl } from '@/components/gov/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { GovTask } from '@/data/gov-tasks';
import type { RequirementsCheck } from '@/lib/gov-types';

type Props = {
  task: GovTask;
  check: RequirementsCheck | null;
  loading: boolean;
  onRefresh: () => void;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Step 1: current requirements, fee and steps, checked on the official sites.
export function NeedsStep({ task, check, loading, onRefresh }: Props) {
  if (loading || !check) {
    return (
      <Card>
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.muted}>Checking the official sites for the latest requirements and fee...</Text>
        </View>
      </Card>
    );
  }

  return (
    <>
      <Card title="Fee">
        <Text style={[styles.fee, check.fee.length > 30 && styles.feeLong]}>{check.fee}</Text>
        <Text style={styles.muted}>{check.where}</Text>
      </Card>

      <Card title="What you need">
        {check.items.map((item, index) => (
          <View key={index} style={styles.item}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.itemText}>
              {item.label}
              {item.note ? <Text style={styles.muted}>{`\n${item.note}`}</Text> : null}
            </Text>
          </View>
        ))}
      </Card>

      <Card title="Steps">
        {check.steps.map((step, index) => (
          <View key={index} style={styles.item}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.itemText}>{step}</Text>
          </View>
        ))}
      </Card>

      {check.mode === 'ai' ? (
        <Note>
          Checked on official sites on {formatDate(check.checkedAt)}. Always confirm the fee on the invoice before you pay.
        </Note>
      ) : (
        <Note tone="warn">
          This is our saved guide. Fees change, so confirm the amount on {task.portal.label.replace(/^Open /, '')} before paying.
        </Note>
      )}

      <View style={styles.links}>
        {check.sources.map((source) => (
          <LinkButton key={source.url} label={source.title || source.url} onPress={() => openUrl(source.url)} />
        ))}
        {check.mode === 'ai' && <LinkButton label="Check again" icon="arrow-forward-circle" onPress={onRefresh} />}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  fee: { fontSize: 20, fontWeight: '700', color: Colors.navy },
  feeLong: { fontSize: 16 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  item: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  bullet: { fontSize: 14, color: Colors.primary, lineHeight: 20 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primarySoft,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
  itemText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
