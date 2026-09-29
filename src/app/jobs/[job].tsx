import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LinkButton, Note } from '@/components/gov/ui';
import { AdvertStep, MatchStep } from '@/components/jobs/advert-match-steps';
import { ApplyStep, CvStep } from '@/components/jobs/cv-apply-steps';
import { JobTrackStep } from '@/components/jobs/track-step';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Profile } from '@/data/profile-fields';
import { useAuth } from '@/lib/auth';
import type { HelperAction } from '@/lib/gov-types';
import { checkMatch, interviewQuestions, tailorApplication } from '@/lib/jobs-client';
import { deleteJob, GUEST_ID, loadJob, saveJob } from '@/lib/jobs-store';
import type { Job } from '@/lib/jobs-types';
import { listFiles, type StoredFile } from '@/lib/locker-store';
import { loadProfile, saveProfile } from '@/lib/profile-store';

const stepNames = ['Advert', 'Match', 'CV & letter', 'Apply', 'Track'];

export default function JobScreen() {
  const router = useRouter();
  const { job: jobId } = useLocalSearchParams<{ job: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;

  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const jobRef = useRef<Job | null>(null);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({});
  const [lockerFiles, setLockerFiles] = useState<StoredFile[]>([]);
  const [busy, setBusy] = useState<'match' | 'write' | 'questions' | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    loadJob(userId, jobId).then((found) => {
      jobRef.current = found;
      setJob(found);
      // Returning users land on the tracker once they've applied.
      if (found && found.status >= 1) setStep(4);
    });
    loadProfile(userId).then(setProfile);
    if (user) listFiles(user.id).then(setLockerFiles).catch(() => {});
  }, [jobId, userId, user]);

  if (job === undefined) {
    return (
      <Screen>
        <SubHeader title="Job" />
        <ActivityIndicator color={Colors.primary} />
      </Screen>
    );
  }
  if (!job) {
    return (
      <Screen>
        <SubHeader title="Job" />
        <Note tone="warn">That job wasn’t found.</Note>
      </Screen>
    );
  }

  // Changes build on the latest saved job, so several can land together.
  const update = async (change: (current: Job) => Job) => {
    const next = change(jobRef.current!);
    jobRef.current = next;
    setJob(next);
    await saveJob(userId, next);
  };

  const careerEmpty = !profile.experience && !profile.education && !profile.skills;
  const lockerNames = lockerFiles.map((file) => `${file.category}/${file.name}`);

  const run = async (kind: 'match' | 'write' | 'questions', work: () => Promise<void>) => {
    setBusy(kind);
    setProblem('');
    try {
      await work();
    } catch {
      setProblem('Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const onCheck = () =>
    run('match', async () => {
      const match = await checkMatch(job.advert, { profile, lockerFiles: lockerNames });
      await update((current) => ({ ...current, match }));
    });

  const onWrite = () =>
    run('write', async () => {
      const application = await tailorApplication(job.advert, profile);
      await update((current) => ({ ...current, application }));
    });

  const onPrepare = () =>
    run('questions', async () => {
      const questions = await interviewQuestions(job.advert, profile);
      await update((current) => ({ ...current, questions }));
    });

  const setStatus = (status: number) =>
    update((current) => {
      const statusDates = Object.fromEntries(Object.entries(current.statusDates).filter(([index]) => Number(index) <= status));
      for (let index = 0; index <= status; index++) statusDates[index] ??= new Date().toISOString();
      return { ...current, status: Math.max(status, 0), statusDates };
    });

  const savePortal = async (answers: Record<string, string>, profileChanges: Profile) => {
    const [saved] = await Promise.all([
      saveProfile(userId, profileChanges),
      update((current) => ({ ...current, portalAnswers: answers })),
    ]);
    setProfile(saved);
  };

  const runHelperAction = (action: HelperAction) => {
    if (action.type === 'open') router.push(action.route as Href);
    else if (action.type === 'stage') setStatus(action.stage);
  };

  const remove = async () => {
    await deleteJob(userId, job.id);
    router.back();
  };

  return (
    <Screen>
      <SubHeader title={job.advert.title} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {stepNames.map((name, index) => (
          <Pressable key={name} onPress={() => setStep(index)} style={[styles.tab, index === step && styles.tabActive]}>
            <Text style={[styles.tabText, index === step && styles.tabTextActive]}>
              {index + 1}. {name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {!!problem && <Note tone="warn">{problem}</Note>}

      {step === 0 && <AdvertStep job={job} onDelete={remove} />}
      {step === 1 && <MatchStep job={job} careerEmpty={careerEmpty} checking={busy === 'match'} onCheck={onCheck} />}
      {step === 2 && <CvStep job={job} profile={profile} careerEmpty={careerEmpty} writing={busy === 'write'} onWrite={onWrite} />}
      {step === 3 && (
        <ApplyStep
          key={lockerFiles.length}
          job={job}
          user={user}
          profile={profile}
          lockerFiles={lockerFiles}
          onGoToCv={() => setStep(2)}
          onSavePortal={savePortal}
          onHelperAction={runHelperAction}
          onApplied={() => {
            setStatus(1);
            setStep(4);
          }}
        />
      )}
      {step === 4 && (
        <JobTrackStep
          job={job}
          onSetStatus={setStatus}
          onToggleClosed={() => update((current) => ({ ...current, closed: !current.closed }))}
          preparing={busy === 'questions'}
          onPrepare={onPrepare}
        />
      )}

      <View style={styles.footer}>
        {step < stepNames.length - 1 && (
          <Pressable onPress={() => setStep(step + 1)} style={({ pressed }) => [styles.next, pressed && styles.dim]}>
            <Text style={styles.nextText}>Next: {stepNames[step + 1]}</Text>
          </Pressable>
        )}
        <LinkButton
          icon="chatbubbles"
          label="Ask about this job"
          onPress={() =>
            router.push({
              pathname: '/chat',
              params: { q: `I have a question about the ${job.advert.title} job${job.advert.employer ? ` at ${job.advert.employer}` : ''}.` },
            })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: Spacing.sm },
  tab: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tabTextActive: { color: Colors.onDark },
  footer: { gap: Spacing.md, alignItems: 'flex-start' },
  next: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
  },
  nextText: { fontSize: 15, fontWeight: '600', color: Colors.onDark },
  dim: { opacity: 0.7 },
});
