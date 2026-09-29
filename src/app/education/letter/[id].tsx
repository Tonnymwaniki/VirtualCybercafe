import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CheckRow, LinkButton, Note } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { reportingLabel } from '@/lib/edu-dates';
import { LETTER_KEY, type SavedLetter } from '@/lib/edu-types';
import { GUEST_ID } from '@/lib/profile-store';
import { deleteRecord, loadRecords, saveRecord } from '@/lib/record-store';

// One admission letter or fee structure: fees, how to pay, what to bring.
export default function LetterScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [saved, setSaved] = useState<SavedLetter | null | undefined>(undefined);
  const savedRef = useRef<SavedLetter | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    loadRecords<SavedLetter>(userId, LETTER_KEY).then((records) => {
      savedRef.current = records[id] ?? null;
      setSaved(savedRef.current);
    });
  }, [userId, id]);

  if (saved === undefined) {
    return (
      <Screen>
        <SubHeader title="Admission letter" />
        <ActivityIndicator color={Colors.primary} />
      </Screen>
    );
  }
  if (!saved) {
    return (
      <Screen>
        <SubHeader title="Admission letter" />
        <Note tone="warn">That letter wasn’t found.</Note>
      </Screen>
    );
  }

  const { letter } = saved;
  const toggle = (item: string) => {
    const current = savedRef.current!;
    const next = { ...current, ready: current.ready.includes(item) ? current.ready.filter((r) => r !== item) : [...current.ready, item] };
    savedRef.current = next;
    setSaved(next);
    saveRecord(userId, LETTER_KEY, next.id, next);
  };

  const remove = async () => {
    await deleteRecord(userId, LETTER_KEY, saved.id);
    router.back();
  };

  return (
    <Screen>
      <SubHeader title={letter.institution || 'Admission letter'} />

      {letter.warnings.length > 0 && (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Check before you pay</Text>
          {letter.warnings.map((w) => (
            <Text key={w} style={styles.warningText}>
              • {w}
            </Text>
          ))}
        </View>
      )}

      <Card>
        {!!letter.course && <Text style={styles.title}>{letter.course}</Text>}
        <Text style={styles.when}>{reportingLabel(letter.reportingDate)}</Text>
        {!!letter.reportingText && <Text style={styles.muted}>{letter.reportingText}</Text>}
      </Card>

      {letter.fees.length > 0 && (
        <Card title="Fees">
          {letter.fees.map((fee, index) => (
            <View key={index} style={styles.feeRow}>
              <Text style={styles.feeItem}>{fee.item}</Text>
              <Text style={styles.feeAmount}>{fee.amount}</Text>
            </View>
          ))}
          {!!letter.total && (
            <View style={[styles.feeRow, styles.totalRow]}>
              <Text style={styles.total}>Total</Text>
              <Text style={styles.total}>{letter.total}</Text>
            </View>
          )}
        </Card>
      )}

      <Card title="How to pay">
        <Text style={styles.item}>{letter.payment || 'The letter doesn’t say. Ask the institution’s finance office.'}</Text>
        <Text style={styles.muted}>
          Pay only to the institution’s bank account or official paybill printed on the letter, and keep every receipt. If
          you have student funding, check what it covers first.
        </Text>
      </Card>

      {letter.toBring.length > 0 && (
        <Card title={`What to bring (${saved.ready.length} of ${letter.toBring.length} ready)`}>
          {letter.toBring.map((item) => (
            <CheckRow key={item} label={item} checked={saved.ready.includes(item)} onToggle={() => toggle(item)} />
          ))}
        </Card>
      )}

      {letter.notes.length > 0 && (
        <Card title="Also note">
          {letter.notes.map((note) => (
            <Text key={note} style={styles.item}>
              • {note}
            </Text>
          ))}
        </Card>
      )}

      <Note>I read this from your letter. Check the amounts and account numbers against the original before paying.</Note>
      <LinkButton
        icon="chatbubbles"
        label="Ask about this letter"
        onPress={() =>
          router.push({
            pathname: '/chat',
            params: { q: `I have a question about my admission to ${letter.course || 'a course'} at ${letter.institution || 'college'}.` },
          })
        }
      />
      <View style={styles.row}>
        <Button
          label={confirm ? 'Tap again to remove' : 'Remove this letter'}
          icon="trash"
          variant="secondary"
          onPress={() => (confirm ? remove() : setConfirm(true))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: Colors.navy },
  when: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  item: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  feeItem: { flex: 1, fontSize: 14, color: Colors.text },
  feeAmount: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  total: { fontSize: 15, fontWeight: '700', color: Colors.navy },
  row: { flexDirection: 'row', gap: Spacing.md },
  warning: { backgroundColor: '#FEE2E2', borderRadius: Radius.lg, padding: Spacing.lg, gap: 6, borderWidth: 1, borderColor: '#FCA5A5' },
  warningTitle: { fontSize: 15, fontWeight: '700', color: '#B91C1C' },
  warningText: { fontSize: 13, color: '#7F1D1D', lineHeight: 19 },
});
