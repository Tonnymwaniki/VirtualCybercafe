import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CheckRow, LinkButton, Note } from '@/components/gov/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { deadlineLabel } from '@/lib/jobs-store';
import { jobStatuses, type Job } from '@/lib/jobs-types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type Props = {
  job: Job;
  onSetStatus: (status: number) => void;
  onToggleClosed: () => void;
  preparing: boolean;
  onPrepare: () => void;
};

// Step 5: where the application is, and interview practice.
export function JobTrackStep({ job, onSetStatus, onToggleClosed, preparing, onPrepare }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const { advert } = job;
  return (
    <>
      <Card title="Your application">
        <Text style={styles.deadline}>{deadlineLabel(advert.deadline)}</Text>
        {jobStatuses.map((status, index) => {
          const checked = index <= job.status;
          const date = job.statusDates[index];
          return (
            <CheckRow
              key={status}
              label={status}
              detail={checked && date ? formatDate(date) : undefined}
              checked={checked}
              onToggle={() => onSetStatus(index === job.status ? index - 1 : index)}
            />
          );
        })}
        <CheckRow label="Not successful this time" checked={!!job.closed} onToggle={onToggleClosed} />
      </Card>
      {job.status >= 4 && <Note tone="good">Congratulations on the offer! Keep the offer letter in your Locker.</Note>}
      {job.closed && <Note>Every application is practice. Your details are saved, so the next one is quicker.</Note>}

      <Card title="Interview practice">
        {!job.questions ? (
          <Text style={styles.muted}>Questions this employer is likely to ask, with tips drawn from your own experience.</Text>
        ) : (
          job.questions.map((q, index) => (
            <Pressable key={index} onPress={() => setOpen(open === index ? null : index)} style={styles.question}>
              <Text style={styles.questionText}>
                {index + 1}. {q.question}
              </Text>
              {open === index ? <Text style={styles.tip}>Tip: {q.tip}</Text> : <Text style={styles.show}>Show tip</Text>}
            </Pressable>
          ))
        )}
        <View style={styles.row}>
          <Button
            label={job.questions ? 'New questions' : 'Get practice questions'}
            icon="school"
            variant={job.questions ? 'secondary' : 'primary'}
            onPress={onPrepare}
            busy={preparing}
          />
        </View>
        <LinkButton
          icon="chatbubbles"
          label="Practise out loud with the attendant"
          onPress={() =>
            router.push({
              pathname: '/chat',
              params: {
                q: `Help me practise for my interview for ${advert.title}${advert.employer ? ` at ${advert.employer}` : ''}. Ask me one question at a time and give me short feedback on each answer.`,
              },
            })
          }
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  deadline: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  row: { flexDirection: 'row', gap: Spacing.md },
  question: { gap: 4, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, borderRadius: Radius.sm },
  questionText: { fontSize: 14, fontWeight: '600', color: Colors.text, lineHeight: 20 },
  tip: { fontSize: 13, color: Colors.text, lineHeight: 19 },
  show: { fontSize: 12, fontWeight: '600', color: Colors.primary },
});
