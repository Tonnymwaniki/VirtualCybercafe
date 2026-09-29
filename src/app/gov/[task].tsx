import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailsStep } from '@/components/gov/details-step';
import { NeedsStep } from '@/components/gov/needs-step';
import { PayStep, TrackStep } from '@/components/gov/pay-track-steps';
import { ReadyStep } from '@/components/gov/ready-step';
import { LinkButton, Note } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { findGovTask } from '@/data/gov-tasks';
import { useAuth } from '@/lib/auth';
import { fetchRequirements } from '@/lib/gov-client';
import { GUEST_ID, loadAllProgress, loadIdDetails, saveIdDetails, saveProgress } from '@/lib/gov-store';
import {
  emptyIdDetails,
  emptyProgress,
  type IdDetails,
  type RequirementsCheck,
  type TaskProgress,
} from '@/lib/gov-types';

const stepNames = ['What you need', 'Are you ready?', 'Your details', 'Pay', 'Track'];

export default function GovTaskScreen() {
  const router = useRouter();
  const { task: taskId } = useLocalSearchParams<{ task: string }>();
  const task = findGovTask(taskId);
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;

  const [step, setStep] = useState(0);
  const [check, setCheck] = useState<RequirementsCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<TaskProgress>(emptyProgress);
  const [idDetails, setIdDetails] = useState<IdDetails>(emptyIdDetails);

  const runCheck = useCallback(
    async (refresh = false) => {
      if (!task) return;
      setChecking(true);
      setCheck(await fetchRequirements(task.id, refresh));
      setChecking(false);
    },
    [task],
  );

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  useEffect(() => {
    if (!task) return;
    loadAllProgress(userId).then((all) => {
      const saved = all[task.id];
      setProgress(saved ?? emptyProgress);
      // Returning users land where they left off.
      if (saved && saved.stage >= 0) setStep(4);
    });
    loadIdDetails(userId).then(setIdDetails);
  }, [task, userId]);

  if (!task) {
    return (
      <Screen>
        <SubHeader title="Government Services" />
        <Note tone="warn">That task wasn’t found.</Note>
      </Screen>
    );
  }

  const updateProgress = (next: TaskProgress) => {
    setProgress(next);
    saveProgress(userId, task.id, next);
  };

  const toggleReady = (id: string) =>
    updateProgress({
      ...progress,
      ready: progress.ready.includes(id) ? progress.ready.filter((r) => r !== id) : [...progress.ready, id],
    });

  const setStage = (stage: number) => {
    const stageDates = Object.fromEntries(
      Object.entries(progress.stageDates).filter(([index]) => Number(index) <= stage),
    );
    for (let index = 0; index <= stage; index++) stageDates[index] ??= new Date().toISOString();
    updateProgress({ ...progress, stage, stageDates });
  };

  const saveDetails = async (answers: Record<string, string>, nextId: IdDetails) => {
    setIdDetails(nextId);
    const next = { ...progress, answers };
    setProgress(next);
    await Promise.all([saveIdDetails(userId, nextId), saveProgress(userId, task.id, next)]);
  };

  return (
    <Screen>
      <SubHeader title={task.title} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {stepNames.map((name, index) => (
          <Pressable
            key={name}
            onPress={() => setStep(index)}
            style={[styles.tab, index === step && styles.tabActive]}>
            <Text style={[styles.tabText, index === step && styles.tabTextActive]}>
              {index + 1}. {name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {step === 0 && <NeedsStep task={task} check={check} loading={checking} onRefresh={() => runCheck(true)} />}
      {step === 1 && <ReadyStep task={task} user={user} ready={progress.ready} onToggle={toggleReady} />}
      {step === 2 && (
        <DetailsStep task={task} idDetails={idDetails} answers={progress.answers} onSave={saveDetails} />
      )}
      {step === 3 && <PayStep task={task} check={check} />}
      {step === 4 && <TrackStep task={task} progress={progress} onSetStage={setStage} />}

      <View style={styles.footer}>
        {step < stepNames.length - 1 && (
          <Pressable onPress={() => setStep(step + 1)} style={({ pressed }) => [styles.next, pressed && styles.dim]}>
            <Text style={styles.nextText}>Next: {stepNames[step + 1]}</Text>
          </Pressable>
        )}
        <LinkButton
          icon="chatbubbles"
          label="Ask about this task"
          onPress={() => router.push({ pathname: '/chat', params: { task: task.id } })}
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
