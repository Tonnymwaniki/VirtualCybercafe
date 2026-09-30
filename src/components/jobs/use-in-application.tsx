import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { isLiveWorkspace } from '@/data/launch';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { addJobDocument, deadlineLabel, GUEST_ID, loadJobs, openJobs } from '@/lib/jobs-store';
import type { Job } from '@/lib/jobs-types';
import { supabase } from '@/lib/supabase';
import { saveToLocker, size, type WorkFile } from '@/lib/workbench/files';
import { explainedText, explainError } from '@/lib/workbench/explain';

type State =
  | { step: 'idle' }
  | { step: 'loading' }
  | { step: 'pick'; jobs: Job[] }
  | { step: 'saving'; job: Job }
  | { step: 'added'; job: Job }
  | { step: 'failed'; text: string };

// "Use in application": keeps the file in the Locker and adds it to a saved
// job's supporting documents, so the Apply step and the application pack
// have it ready. A file already in the Locker passes its path instead.
export function UseInApplication({ file, lockerPath }: { file: WorkFile | { name: string; mimeType: string; bytes: number | null }; lockerPath?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.id ?? GUEST_ID;
  const [state, setState] = useState<State>({ step: 'idle' });

  if (!isLiveWorkspace('jobs')) return null;

  const start = async () => {
    // With accounts switched on, the Locker needs a signed-in user.
    if (supabase && !user) {
      setState({ step: 'failed', text: t('useApp.signIn') });
      return;
    }
    setState({ step: 'loading' });
    try {
      setState({ step: 'pick', jobs: openJobs(await loadJobs(userId)).slice(0, 5) });
    } catch (error) {
      setState({ step: 'failed', text: explainedText(explainError(error, 'lockerFile', t)) });
    }
  };

  const add = async (job: Job) => {
    setState({ step: 'saving', job });
    try {
      const bytes = 'kind' in file ? size(file) : file.bytes ?? 0;
      const path = lockerPath ?? (await saveToLocker(userId, file as WorkFile, 'Certificates'));
      await addJobDocument(userId, job.id, { path, name: file.name, mimeType: file.mimeType, bytes, addedAt: new Date().toISOString() });
      setState({ step: 'added', job });
    } catch (error) {
      setState({ step: 'failed', text: explainedText(explainError(error, 'locker', t)) });
    }
  };

  if (state.step === 'idle' || state.step === 'loading') {
    return (
      <Pressable onPress={start} disabled={state.step === 'loading'} style={({ pressed }) => [styles.link, pressed && styles.dim]}>
        {state.step === 'loading' ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="briefcase-outline" size={16} color={Colors.primary} />}
        <Text style={styles.linkText}>{t('useApp.link')}</Text>
      </Pressable>
    );
  }
  if (state.step === 'failed') {
    return (
      <Pressable onPress={() => setState({ step: 'idle' })} style={styles.panel}>
        <Text style={styles.muted}>{state.text}</Text>
      </Pressable>
    );
  }
  if (state.step === 'added') {
    return (
      <View style={[styles.panel, styles.good]}>
        <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
        <Text style={styles.text}>{t('useApp.added', { title: state.job.advert.title })}</Text>
        <Pressable onPress={() => router.push(`/jobs/${state.job.id}?step=3` as Href)} hitSlop={6}>
          <Text style={styles.linkText}>{t('useApp.openJob')}</Text>
        </Pressable>
      </View>
    );
  }
  if (state.step === 'saving') {
    return (
      <View style={styles.panel}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.text}>{t('useApp.adding', { title: state.job.advert.title })}</Text>
      </View>
    );
  }
  return (
    <View style={styles.pick}>
      <Text style={styles.label}>{t('useApp.which')}</Text>
      {state.jobs.length === 0 && (
        <>
          <Text style={styles.muted}>{t('useApp.none')}</Text>
          <Pressable onPress={() => router.push('/jobs' as Href)} hitSlop={6}>
            <Text style={styles.linkText}>{t('useApp.openJobs')}</Text>
          </Pressable>
        </>
      )}
      {state.jobs.map((job) => (
        <Pressable key={job.id} onPress={() => add(job)} style={({ pressed }) => [styles.jobRow, pressed && styles.dim]}>
          <Ionicons name="briefcase" size={18} color={Colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {job.advert.title}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {[job.advert.employer, deadlineLabel(job.advert.deadline)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
        </Pressable>
      ))}
      <Pressable onPress={() => setState({ step: 'idle' })} hitSlop={6}>
        <Text style={styles.cancel}>{t('common.cancel')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  linkText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  panel: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.background },
  good: { backgroundColor: '#ECFDF5' },
  pick: { gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.background },
  label: { fontSize: 14, fontWeight: '700', color: Colors.text },
  text: { flexShrink: 1, fontSize: 14, color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  jobTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  flex: { flex: 1 },
  cancel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  dim: { opacity: 0.6 },
});
