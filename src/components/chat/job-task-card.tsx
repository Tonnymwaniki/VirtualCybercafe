import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Profile } from '@/data/profile-fields';
import { useAuth } from '@/lib/auth';
import { useLanguage, type TextKey, type Translate } from '@/lib/i18n';
import { deadlineLabel, GUEST_ID, loadJobs, onJobsChanged, openJobs } from '@/lib/jobs-store';
import type { Job } from '@/lib/jobs-types';
import { loadProfile } from '@/lib/profile-store';

type Line = { label: string; detail: string; done: boolean; route?: string; action?: string };

const applyLabel: Record<string, TextKey> = {
  email: 'jobCard.applyEmail',
  portal: 'jobCard.applyForm',
  in_person: 'jobCard.applyInPerson',
  post: 'jobCard.applyPost',
  unknown: 'jobCard.applySend',
};

// The steps of applying for this job, ticked from the saved job record, My
// Details and the files added to it: the same record the Jobs screen uses.
function linesFor(t: Translate, job: Job, profile: Profile): Line[] {
  const careerDone = !!(profile.experience || profile.education || profile.skills);
  const wanted = job.advert.documents;
  const have = job.documents?.length ?? 0;
  const method = job.advert.howToApply.method;
  return [
    {
      label: t('jobCard.advert'),
      detail: [job.advert.employer, deadlineLabel(job.advert.deadline)].filter(Boolean).join(' · '),
      done: true,
      route: `/jobs/${job.id}?step=0`,
      action: t('common.open'),
    },
    {
      label: t('jobCard.career'),
      detail: careerDone ? t('jobCard.careerDone') : t('jobCard.careerTodo'),
      done: careerDone,
      route: '/profile',
      action: t('jobCard.add'),
    },
    {
      label: t('jobCard.cv'),
      detail: job.application ? t('jobCard.cvDone') : t('jobCard.cvTodo'),
      done: !!job.application,
      route: `/jobs/${job.id}?step=2`,
      action: job.application ? t('common.open') : t('jobCard.write'),
    },
    {
      label: t('jobCard.docs'),
      detail: wanted.length
        ? t('jobCard.docsWanted', { have: Math.min(have, wanted.length), total: wanted.length, list: wanted.join(', ') })
        : have
          ? t('jobCard.docsHave', { n: have })
          : t('jobCard.docsNone'),
      done: wanted.length ? have >= wanted.length : true,
      route: '/studio',
      action: t('jobCard.prepare'),
    },
    {
      label: t(applyLabel[method] ?? applyLabel.unknown),
      detail: job.status >= 1 ? t('jobCard.applied') : t('jobCard.applyTodo'),
      done: job.status >= 1,
      route: `/jobs/${job.id}?step=3`,
      action: t('common.open'),
    },
  ];
}

// "Apply for a job" in the chat: a live checklist that follows the job
// record, whether the person works here in the chat or on the Jobs screen.
export function JobTaskCard({
  jobId,
  jobTitle,
  createdAt,
  onLink,
}: {
  jobId?: string;
  jobTitle?: string;
  createdAt: string;
  onLink?: (jobId: string) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.id ?? GUEST_ID;
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [profile, setProfile] = useState<Profile>({});

  const load = useCallback(() => {
    loadJobs(userId).then(setJobs).catch(() => setJobs([]));
    loadProfile(userId).then(setProfile).catch(() => {});
  }, [userId]);

  useFocusEffect(load);
  useEffect(() => onJobsChanged(load), [load]);

  // A job saved after the card appeared (for example from an advert pasted
  // in this chat) is the one being applied for.
  const newer = jobs?.filter((j) => j.createdAt > createdAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const job = jobs?.find((j) => j.id === jobId) ?? (jobId ? undefined : newer);
  const linked = useRef(false);
  useEffect(() => {
    if (job && !jobId && !linked.current) {
      linked.current = true;
      onLink?.(job.id);
    }
  }, [job, jobId, onLink]);

  if (!jobs) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!job) {
    const title = (jobTitle ?? '').toLowerCase();
    const choices = openJobs(jobs)
      .sort((a, b) => Number(!!title && b.advert.title.toLowerCase().includes(title)) - Number(!!title && a.advert.title.toLowerCase().includes(title)))
      .slice(0, 3);
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>{t('jobCard.kicker')}</Text>
        <Text style={styles.title}>{jobTitle ? t('jobCard.applyingFor', { title: jobTitle }) : t('jobCard.which')}</Text>
        <View style={styles.line}>
          <Ionicons name="ellipse-outline" size={20} color={Colors.textMuted} />
          <View style={styles.flex}>
            <Text style={styles.lineLabel}>{t('jobCard.advert')}</Text>
            <Text style={styles.detail}>{t('jobCard.pasteAdvert')}</Text>
          </View>
        </View>
        {choices.map((choice) => (
          <Pressable key={choice.id} onPress={() => onLink?.(choice.id)} style={({ pressed }) => [styles.choice, pressed && styles.dim]}>
            <Ionicons name="briefcase" size={18} color={Colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.lineLabel} numberOfLines={1}>
                {choice.advert.title}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                {[choice.advert.employer, deadlineLabel(choice.advert.deadline)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={styles.action}>{t('jobCard.use')}</Text>
          </Pressable>
        ))}
        {[t('jobCard.career'), t('jobCard.cv'), t('jobCard.docs'), t('jobCard.applySend')].map((label) => (
          <View key={label} style={styles.line}>
            <Ionicons name="ellipse-outline" size={20} color={Colors.border} />
            <Text style={[styles.lineLabel, styles.later]}>{label}</Text>
          </View>
        ))}
        <Pressable onPress={() => router.push('/jobs' as Href)} style={({ pressed }) => [styles.secondary, pressed && styles.dim]}>
          <Ionicons name="search" size={16} color={Colors.primary} />
          <Text style={styles.action}>{t('jobCard.find')}</Text>
        </Pressable>
      </View>
    );
  }

  const lines = linesFor(t, job, profile);
  const done = lines.filter((l) => l.done).length;
  const next = lines.find((l) => !l.done);
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{t('jobCard.kicker')}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {job.advert.title}
      </Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${(done / lines.length) * 100}%` }]} />
      </View>
      {lines.map((line) => (
        <Pressable
          key={line.label}
          onPress={() => line.route && router.push(line.route as Href)}
          style={({ pressed }) => [styles.line, pressed && styles.dim]}>
          <Ionicons
            name={line.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={line.done ? Colors.success : line === next ? Colors.primary : Colors.textMuted}
          />
          <View style={styles.flex}>
            <Text style={[styles.lineLabel, line.done && styles.doneLabel]}>{line.label}</Text>
            {!!line.detail && <Text style={styles.detail}>{line.detail}</Text>}
          </View>
          {line === next && <Text style={styles.action}>{line.action}</Text>}
        </Pressable>
      ))}
      {next ? (
        <Pressable onPress={() => next.route && router.push(next.route as Href)} style={({ pressed }) => [styles.primary, pressed && styles.dim]}>
          <Text style={styles.primaryText}>{t('jobCard.next', { step: next.label })}</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.onDark} />
        </Pressable>
      ) : (
        <Text style={styles.detail}>{t('jobCard.allDone')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: Colors.primary },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  bar: { height: 6, borderRadius: 3, backgroundColor: Colors.primarySoft, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: Colors.success },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 2 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  flex: { flex: 1 },
  lineLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  doneLabel: { color: Colors.text },
  later: { color: Colors.textMuted, fontWeight: '500' },
  detail: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  action: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 10, marginTop: 4 },
  primaryText: { fontSize: 14, fontWeight: '700', color: Colors.onDark },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  dim: { opacity: 0.6 },
});
