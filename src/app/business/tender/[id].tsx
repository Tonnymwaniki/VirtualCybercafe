import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TenderCard } from '@/components/biz/tender-card';
import { Button } from '@/components/button';
import { Card, CheckRow, LinkButton, Note } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { TENDER_KEY, tenderStatuses, type SavedTender } from '@/lib/biz-types';
import { useAuth } from '@/lib/auth';
import { listFiles, type StoredFile } from '@/lib/locker-store';
import { GUEST_ID, loadProfile } from '@/lib/profile-store';
import { deleteRecord, loadRecords, saveRecord } from '@/lib/record-store';

// Words that tie a tender document to a Locker file name.
const lockerHints: [RegExp, RegExp][] = [
  [/registration|incorporation|business name/i, /business-certificate|certificate-of-incorporation|registration/i],
  [/kra pin|pin certificate/i, /kra-pin/i],
  [/tax compliance|tcc/i, /tax-compliance|tcc/i],
  [/agpo/i, /agpo/i],
  [/cr ?12/i, /cr12/i],
  [/\bid\b|identity/i, /national-id/i],
  [/permit|licen[cs]e/i, /permit|licen[cs]e/i],
];

function inLocker(document: string, files: StoredFile[]) {
  const hint = lockerHints.find(([doc]) => doc.test(document));
  return hint ? files.find((f) => hint[1].test(f.name)) : undefined;
}

// One tracked tender: documents to gather and where the bid stands.
export default function TenderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [saved, setSaved] = useState<SavedTender | null | undefined>(undefined);
  const [agpo, setAgpo] = useState('');
  const [files, setFiles] = useState<StoredFile[]>([]);

  useEffect(() => {
    loadRecords<SavedTender>(userId, TENDER_KEY).then((records) => setSaved(records[id] ?? null));
    loadProfile(userId).then((p) => setAgpo(p.agpoCategory ?? ''));
    if (user) listFiles(user.id).then(setFiles).catch(() => {});
  }, [userId, id, user]);

  if (saved === undefined) {
    return (
      <Screen>
        <SubHeader title="Tender" />
      </Screen>
    );
  }
  if (!saved) {
    return (
      <Screen>
        <SubHeader title="Tender" />
        <Note tone="warn">This tender was not found. It may have been removed.</Note>
      </Screen>
    );
  }

  const update = async (changes: Partial<SavedTender>) => {
    const next = { ...saved, ...changes };
    setSaved(next);
    await saveRecord(userId, TENDER_KEY, next.id, next);
  };

  const toggle = (index: number) =>
    update({ ready: saved.ready.includes(index) ? saved.ready.filter((i) => i !== index) : [...saved.ready, index] });

  const { tender } = saved;
  return (
    <Screen>
      <SubHeader title="Tender" />
      <TenderCard tender={tender} agpoCategory={agpo} />

      {!!tender.howToApply && (
        <Card title="How to apply">
          <Text style={styles.body}>{tender.howToApply}</Text>
        </Card>
      )}

      <Card title="Documents to submit">
        {tender.documents.length === 0 && (
          <Text style={styles.muted}>The tender page did not list them. Download the tender document to see the full list.</Text>
        )}
        {tender.documents.map((doc, index) => {
          const file = inLocker(doc, files);
          return (
            <CheckRow
              key={doc}
              label={doc}
              detail={file ? `In your Locker: ${file.name}` : undefined}
              checked={saved.ready.includes(index)}
              onToggle={() => toggle(index)}
            />
          );
        })}
        <LinkButton label="Open my Locker" icon="cloud-upload" onPress={() => router.push('/locker')} />
      </Card>

      <Card title="Where is your bid?">
        <View style={styles.statuses}>
          {tenderStatuses.map((label, index) => (
            <Pressable
              key={label}
              onPress={() => update({ status: index })}
              style={[styles.chip, saved.status === index && styles.chipActive]}>
              <Text style={[styles.chipText, saved.status === index && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {saved.status === 3 && <Note tone="good">Congratulations! Keep the award letter and LPO in your Locker.</Note>}
      </Card>

      <View style={styles.row}>
        <Button
          label="Stop tracking"
          icon="trash"
          variant="secondary"
          onPress={async () => {
            await deleteRecord(userId, TENDER_KEY, saved.id);
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, color: Colors.text, lineHeight: 21 },
  muted: { fontSize: 13, color: Colors.textMuted },
  row: { flexDirection: 'row', gap: Spacing.md },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: Colors.onDark },
});
