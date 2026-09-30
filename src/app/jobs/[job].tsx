import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LinkButton, Note } from '@/components/gov/ui';
import { AdvertStep, MatchStep } from '@/components/jobs/advert-match-steps';
import { ApplyStep, CvStep } from '@/components/jobs/cv-apply-steps';
import { JobTrackStep } from '@/components/jobs/track-step';
import { Screen } from '@/components/screen';
import { StepFooter, StepHeader } from '@/components/stepper';
import { SubHeader } from '@/components/sub-header';
import { Colors, Spacing } from '@/constants/theme';
import type { Profile } from '@/data/profile-fields';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import type { HelperAction } from '@/lib/gov-types';
import { checkMatch, interviewQuestions, tailorApplication } from '@/lib/jobs-client';
import { deleteJob, GUEST_ID, loadJob, saveJob } from '@/lib/jobs-store';
import type { Job } from '@/lib/jobs-types';
import { listFiles, type StoredFile } from '@/lib/locker-store';
import { loadProfile, saveProfile } from '@/lib/profile-store';
import { supabase } from '@/lib/supabase';


export default function JobScreen() {
  const router = useRouter();
  // ?step= opens a step directly (from the chat's task card).
  const { job: jobId, step: stepParam } = useLocalSearchParams<{ job: string; step?: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;

  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const jobRef = useRef<Job | null>(null);
  const [step, setStep] = useState(0);
  const { t } = useLanguage();
  const stepNames = ([1, 2, 3, 4, 5] as const).map((n) => t(`job.step${n}`));
  const [profile, setProfile] = useState<Profile>({});
  const [lockerFiles, setLockerFiles] = useState<StoredFile[]>([]);
  const [busy, setBusy] = useState<'match' | 'write' | 'questions' | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    loadJob(userId, jobId).then((found) => {
      jobRef.current = found;
      setJob(found);
      const wanted = Number(stepParam);
      if (found && wanted >= 0 && wanted <= 4) setStep(wanted);
      // Returning users land on the tracker once they've applied.
      else if (found && found.status >= 1) setStep(4);
    });
    loadProfile(userId).then(setProfile);
    // Demo mode keeps a Locker on this device for guests too.
    if (user || !supabase) listFiles(userId).then(setLockerFiles).catch(() => {});
  }, [jobId, userId, user, stepParam]);

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
    <Screen scrollKey={step}>
      <SubHeader title={job.advert.title} />

      <StepHeader names={stepNames} step={step} onStep={setStep} />

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
        <StepFooter names={stepNames} step={step} onStep={setStep} />
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
  footer: { gap: Spacing.md, alignItems: 'flex-start' },
});
