import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Note } from '@/components/gov/ui';
import { IconBadge } from '@/components/icon-badge';
import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { eduTasks, type GovTaskId } from '@/data/gov-tasks';
import { taskColors } from '@/data/task-colors';
import { useAuth } from '@/lib/auth';
import { readAdmissionLetter } from '@/lib/edu-client';
import { KUCCPS_KEY, kuccpsStages, LETTER_KEY, type KuccpsPlan, type SavedLetter } from '@/lib/edu-types';
import { GUEST_ID, loadAllProgress } from '@/lib/gov-store';
import type { TaskProgress } from '@/lib/gov-types';
import { pickImages, processImage } from '@/lib/images';
import { reportingLabel } from '@/lib/edu-dates';
import { loadRecords, newId, saveRecord } from '@/lib/record-store';

function statusText(stages: string[], progress: TaskProgress | undefined) {
  if (!progress || progress.stage < 0) return 'Not started';
  if (progress.stage >= stages.length - 1) return 'Done';
  return `Last step: ${stages[progress.stage]}`;
}

// The Education workspace: KUCCPS course choice, funding and certificate
// tasks, and admission letters.
export default function EducationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [progress, setProgress] = useState<Partial<Record<GovTaskId, TaskProgress>>>({});
  const [plan, setPlan] = useState<KuccpsPlan | null>(null);
  const [letters, setLetters] = useState<SavedLetter[]>([]);
  const [mode, setMode] = useState<'paste' | 'photo'>('photo');
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadAllProgress(userId).then(setProgress);
      loadRecords<KuccpsPlan>(userId, KUCCPS_KEY).then((records) => setPlan(records.plan ?? null));
      loadRecords<SavedLetter>(userId, LETTER_KEY).then((records) =>
        setLetters(Object.values(records).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      );
    }, [userId]),
  );

  const addLetter = async (input: { text?: string; image?: string }) => {
    setReading(true);
    setProblem('');
    const result = await readAdmissionLetter(input);
    if (!result.letter) {
      setProblem(result.problem);
      setReading(false);
      return;
    }
    const saved: SavedLetter = { id: newId(), letter: result.letter, ready: [], createdAt: new Date().toISOString() };
    await saveRecord(userId, LETTER_KEY, saved.id, saved);
    setReading(false);
    setText('');
    router.push(`/education/letter/${saved.id}` as Href);
  };

  const addPhoto = async (source: 'camera' | 'library') => {
    const [photo] = await pickImages(source);
    if (!photo) return;
    const image = await processImage(photo, { maxSide: 1800, maxBytes: 1_500_000 });
    await addLetter({ image: image.base64 });
  };

  const planStatus = !plan
    ? 'Find courses that fit your KCSE grades'
    : plan.stage >= 0
      ? `Last step: ${kuccpsStages[plan.stage]} · ${plan.choices.length} choices`
      : `${plan.choices.length} choices saved`;

  return (
    <Screen>
      <SubHeader title="Education" />
      <Text style={styles.intro}>
        Choose KUCCPS courses, apply for funding, replace certificates and get ready to report, with your details filled in for you.
      </Text>

      <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
        <Ionicons name="person-circle" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>My Details: your KCSE grades, school and college, saved once</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </Pressable>

      <View style={styles.list}>
        <Pressable onPress={() => router.push('/education/kuccps')} style={({ pressed }) => [styles.card, pressed && styles.dim]}>
          <IconBadge icon="school" color="#14B8A6" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>KUCCPS course choice</Text>
            <Text style={styles.cardDescription}>University, college and TVET placement</Text>
            <Text style={[styles.status, plan && styles.statusActive]}>{planStatus}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>

        {eduTasks.map((task) => {
          const status = statusText(task.stages, progress[task.id]);
          return (
            <Pressable
              key={task.id}
              onPress={() => router.push(`/gov/${task.id}` as Href)}
              style={({ pressed }) => [styles.card, pressed && styles.dim]}>
              <IconBadge icon={task.icon} color={taskColors[task.id]} />
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{task.title}</Text>
                <Text style={styles.cardDescription}>{task.description}</Text>
                <Text style={[styles.status, status !== 'Not started' && styles.statusActive, status === 'Done' && styles.statusDone]}>
                  {status}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      <Card title="Admission letter or fee structure">
        <Text style={styles.muted}>I’ll list the fees, how to pay, what to bring and when to report.</Text>
        <View style={styles.chips}>
          {(['photo', 'paste'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.chip, mode === m && styles.chipActive]}>
              <Text style={[styles.chipText, mode === m && styles.chipTextActive]}>{m === 'photo' ? 'Photo' : 'Paste text'}</Text>
            </Pressable>
          ))}
        </View>
        {mode === 'photo' ? (
          <PickButtons onPick={addPhoto} busy={reading} libraryLabel="Choose photo" />
        ) : (
          <>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Paste the letter or fee structure here"
              placeholderTextColor={Colors.textMuted}
              multiline
              style={styles.input}
            />
            <View style={styles.row}>
              <Button label="Read it" icon="sparkles" onPress={() => addLetter({ text })} busy={reading} disabled={!text.trim()} />
            </View>
          </>
        )}
        {!!problem && <Note tone="warn">{problem}</Note>}
      </Card>

      {letters.map((saved) => (
        <Pressable
          key={saved.id}
          onPress={() => router.push(`/education/letter/${saved.id}` as Href)}
          style={({ pressed }) => [styles.card, pressed && styles.dim]}>
          <IconBadge icon="mail-open" color="#6366F1" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{saved.letter.institution || 'Admission letter'}</Text>
            {!!saved.letter.course && <Text style={styles.cardDescription}>{saved.letter.course}</Text>}
            <Text style={[styles.status, styles.statusActive]}>
              {reportingLabel(saved.letter.reportingDate)} · {saved.ready.length} of {saved.letter.toBring.length} items ready
            </Text>
            {saved.letter.warnings.length > 0 && <Text style={styles.warn}>Check the payment warning</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      ))}

      <Pressable
        onPress={() => router.push({ pathname: '/chat', params: { q: 'I need help with something for school or college' } })}
        style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
        <Ionicons name="chatbubbles" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>Something else? Ask the attendant</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  list: { gap: Spacing.md },
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
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardDescription: { fontSize: 13, color: Colors.textMuted },
  status: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  statusActive: { color: Colors.primary, fontWeight: '600' },
  statusDone: { color: Colors.success },
  warn: { fontSize: 12, color: '#B91C1C', fontWeight: '600' },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: Colors.onDark },
  input: {
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  row: { flexDirection: 'row', gap: Spacing.md },
  dim: { opacity: 0.7 },
});
