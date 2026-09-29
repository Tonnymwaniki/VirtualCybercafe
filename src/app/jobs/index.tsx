import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Note, openUrl } from '@/components/gov/ui';
import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { pickImages, processImage } from '@/lib/images';
import { findJobs, readJobAdvert } from '@/lib/jobs-client';
import { emptyAdvert, findDate } from '@/lib/jobs-sample';
import { deadlineLabel, daysLeft, GUEST_ID, loadJobs, newJob, saveJob } from '@/lib/jobs-store';
import { jobStatuses, type AdvertInput, type FoundJob, type Job } from '@/lib/jobs-types';
import { loadProfile } from '@/lib/profile-store';

type AddMode = 'paste' | 'link' | 'photo';

const modes: { id: AddMode; label: string }[] = [
  { id: 'paste', label: 'Paste advert' },
  { id: 'link', label: 'Link' },
  { id: 'photo', label: 'Photo' },
];

function statusText(job: Job) {
  if (job.closed) return 'Not successful';
  return jobStatuses[job.status] ?? 'Saved';
}

// The Jobs workspace: add or find a job, then work through each one.
export default function JobsScreen() {
  const router = useRouter();
  // The attendant can open this screen with the search filled in.
  const params = useLocalSearchParams<{ q?: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [mode, setMode] = useState<AddMode>('paste');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState('');
  const [query, setQuery] = useState(params.q?.slice(0, 120) ?? '');
  const [county, setCounty] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<FoundJob[] | null>(null);
  const [findNote, setFindNote] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadJobs(userId).then(setJobs);
      loadProfile(userId).then((profile) => setCounty((current) => current || profile.county || ''));
    }, [userId]),
  );

  const open = (job: Job) => router.push(`/jobs/${job.id}` as Href);

  const addFrom = async (input: AdvertInput) => {
    setReading(true);
    setProblem('');
    const result = await readJobAdvert(input);
    setReading(false);
    if (!result.advert) {
      setProblem(result.problem);
      return;
    }
    const job = await saveJob(userId, newJob(result.advert));
    setText('');
    setLink('');
    open(job);
  };

  const addPhoto = async (source: 'camera' | 'library') => {
    const [photo] = await pickImages(source);
    if (!photo) return;
    const image = await processImage(photo, { maxSide: 1800, maxBytes: 1_500_000 });
    await addFrom({ image: image.base64 });
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const result = await findJobs(query.trim(), county.trim());
    setFound(result.jobs);
    setFindNote(result.note);
    setSearching(false);
  };

  // Reads the full advert from its page; if that fails, keeps what the search found.
  const addFound = async (item: FoundJob) => {
    setAdding(item.url);
    const result = await readJobAdvert({ url: item.url });
    const advert = result.advert ?? {
      ...emptyAdvert(),
      title: item.title,
      employer: item.employer,
      location: item.location,
      deadline: findDate(item.deadline),
      deadlineText: item.deadline,
      howToApply: { method: 'portal' as const, email: '', url: item.url, instructions: 'See the advert page.' },
      sourceUrl: item.url,
    };
    const job = await saveJob(userId, newJob({ ...advert, sourceUrl: advert.sourceUrl || item.url }));
    setAdding(null);
    open(job);
  };

  return (
    <Screen>
      <SubHeader title="Jobs & Career" />
      <Text style={styles.intro}>
        Add a job advert and I’ll check how you match, write a CV and cover letter for it, prepare your application and
        track it with you.
      </Text>

      <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
        <Ionicons name="person-circle" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>My Details: your experience, education and skills, saved once</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </Pressable>

      <Card title="Add a job">
        <View style={styles.chips}>
          {modes.map((m) => (
            <Pressable key={m.id} onPress={() => setMode(m.id)} style={[styles.chip, mode === m.id && styles.chipActive]}>
              <Text style={[styles.chipText, mode === m.id && styles.chipTextActive]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
        {mode === 'paste' && (
          <>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Paste the whole job advert here"
              placeholderTextColor={Colors.textMuted}
              multiline
              style={[styles.input, styles.multiline]}
            />
            <View style={styles.row}>
              <Button label="Read the advert" icon="sparkles" onPress={() => addFrom({ text })} busy={reading} disabled={!text.trim()} />
            </View>
          </>
        )}
        {mode === 'link' && (
          <>
            <TextInput
              value={link}
              onChangeText={setLink}
              placeholder="https://..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
            />
            <View style={styles.row}>
              <Button label="Read the advert" icon="sparkles" onPress={() => addFrom({ url: link.trim() })} busy={reading} disabled={!link.trim()} />
            </View>
          </>
        )}
        {mode === 'photo' && (
          <>
            <Text style={styles.muted}>Take a clear photo of a newspaper or notice-board advert, the whole advert in the frame.</Text>
            <PickButtons onPick={addPhoto} busy={reading} libraryLabel="Choose photo" />
          </>
        )}
        {!!problem && <Note tone="warn">{problem}</Note>}
      </Card>

      <Card title="Find jobs">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Job type, e.g. accounts clerk, driver, nurse"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          onSubmitEditing={search}
        />
        <TextInput
          value={county}
          onChangeText={setCounty}
          placeholder="County (optional)"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          onSubmitEditing={search}
        />
        <View style={styles.row}>
          <Button label="Search trusted sites" icon="search" onPress={search} busy={searching} disabled={!query.trim()} />
        </View>
        {found?.map((item) => (
          <View key={item.url} style={styles.found}>
            <Text style={styles.foundTitle}>{item.title}</Text>
            <Text style={styles.muted}>{[item.employer, item.location].filter(Boolean).join(' · ')}</Text>
            {!!item.deadline && <Text style={styles.muted}>Closes: {item.deadline}</Text>}
            {!!item.summary && <Text style={styles.foundSummary}>{item.summary}</Text>}
            <View style={styles.row}>
              <Button label="Open" icon="open-outline" variant="secondary" onPress={() => openUrl(item.url)} />
              <Button label="Add" icon="add" onPress={() => addFound(item)} busy={adding === item.url} disabled={!!adding} />
            </View>
          </View>
        ))}
        {found && found.length === 0 && !findNote && <Text style={styles.muted}>No openings found. Try a broader job type.</Text>}
        {!!findNote && <Text style={styles.muted}>{findNote}</Text>}
      </Card>

      <Text style={styles.heading}>Your jobs</Text>
      {jobs.length === 0 && <Text style={styles.muted}>Jobs you add appear here with their deadline and status.</Text>}
      <View style={styles.list}>
        {jobs.map((job) => {
          const days = daysLeft(job.advert.deadline);
          const urgent = days !== null && days >= 0 && days <= 3 && job.status < 1 && !job.closed;
          return (
            <Pressable key={job.id} onPress={() => open(job)} style={({ pressed }) => [styles.card, pressed && styles.dim]}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{job.advert.title}</Text>
                <Text style={styles.muted}>{[job.advert.employer, job.advert.location].filter(Boolean).join(' · ')}</Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.status, job.status > 0 && !job.closed && styles.statusActive]}>{statusText(job)}</Text>
                  <Text style={[styles.deadline, urgent && styles.urgent]}>{deadlineLabel(job.advert.deadline)}</Text>
                </View>
                {job.advert.scamSignals.length > 0 && (
                  <View style={styles.metaRow}>
                    <Ionicons name="warning" size={14} color="#B91C1C" />
                    <Text style={styles.scam}>Possible scam: read the warning</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => router.push('/cv')} style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
        <Ionicons name="document-text" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>Just need a general CV? Open the CV builder</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  heading: { fontSize: 17, fontWeight: '700', color: Colors.navy, marginTop: Spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: Colors.onDark },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  multiline: { minHeight: 140, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.md },
  found: { gap: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  foundTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  foundSummary: { fontSize: 13, color: Colors.text },
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  status: { fontSize: 12, color: Colors.textMuted },
  statusActive: { color: Colors.primary, fontWeight: '600' },
  deadline: { fontSize: 12, color: Colors.textMuted },
  urgent: { color: Colors.warning, fontWeight: '700' },
  scam: { fontSize: 12, color: '#B91C1C', fontWeight: '600' },
  dim: { opacity: 0.7 },
});
