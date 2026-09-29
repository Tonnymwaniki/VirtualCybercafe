import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CheckRow, Note, openUrl } from '@/components/gov/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { GovTask } from '@/data/gov-tasks';
import type { RequirementsCheck, TaskProgress } from '@/lib/gov-types';

// Step 4: the fee and how to pay it safely. The app never handles money.
export function PayStep({ task, check }: { task: GovTask; check: RequirementsCheck | null }) {
  return (
    <>
      <Card title="Amount">
        <Text style={styles.fee}>{task.payment.free ? 'Free' : (check?.fee ?? 'Checking...')}</Text>
        {!task.payment.free && (
          <Text style={styles.muted}>Pay exactly the amount on your official invoice, even if it differs from this.</Text>
        )}
      </Card>
      <Card title="How to pay">
        {task.payment.howTo.map((line, index) => (
          <View key={index} style={styles.item}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.itemText}>{line}</Text>
          </View>
        ))}
      </Card>
      <Note tone="warn">
        Virtual Cybercafe never asks for your M-Pesa PIN, eCitizen password or iTax password, and never pays for you.
      </Note>
      <View style={styles.row}>
        <Button label={task.portal.label} icon="open-outline" onPress={() => openUrl(task.portal.url)} />
      </View>
    </>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type TrackProps = {
  task: GovTask;
  progress: TaskProgress;
  onSetStage: (stage: number) => void;
};

// Step 5: where the user is with this task. Tapping a stage marks it and
// everything before it done; tapping the last done stage undoes it.
export function TrackStep({ task, progress, onSetStage }: TrackProps) {
  const done = progress.stage >= task.stages.length - 1;
  return (
    <>
      <Card title={done ? 'All done' : 'Your progress'}>
        {task.stages.map((stage, index) => {
          const checked = index <= progress.stage;
          const date = progress.stageDates[index];
          return (
            <CheckRow
              key={stage}
              label={stage}
              detail={checked && date ? `Done ${formatDate(date)}` : undefined}
              checked={checked}
              onToggle={() => onSetStage(index === progress.stage ? index - 1 : index)}
            />
          );
        })}
      </Card>
      {done ? (
        <Note tone="good">Well done! Keep a copy of the result in your Locker.</Note>
      ) : (
        <Note>Tick each stage as you finish it. Your progress is saved, so you can come back any time.</Note>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fee: { fontSize: 20, fontWeight: '700', color: Colors.navy },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  item: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
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
  row: { flexDirection: 'row', gap: Spacing.md },
});
