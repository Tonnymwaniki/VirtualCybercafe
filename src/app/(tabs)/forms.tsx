import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ReadinessBar } from '@/components/forms/readiness';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { findForm, forms } from '@/data/forms';
import { useAuth } from '@/lib/auth';
import { shortDate } from '@/lib/continue';
import { reasonAbout } from '@/lib/forms/reason';
import type { FormEntry } from '@/lib/forms/schema';
import { deleteEntry, loadEntries, onFormsChanged, startEntry } from '@/lib/forms/store';
import { useLanguage } from '@/lib/i18n';
import { loadJobs } from '@/lib/jobs-store';
import type { Job } from '@/lib/jobs-types';
import { GUEST_ID } from '@/lib/profile-store';

// Form Intelligence: the applications being prepared (with how ready each
// is), and new ones to start. The same forms open from Jobs and the chat.
export default function FormsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [entries, setEntries] = useState<FormEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [starting, setStarting] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadEntries(userId).then(setEntries).catch(() => setEntries([]));
    loadJobs(userId).then(setJobs).catch(() => setJobs([]));
  }, [userId]);

  useFocusEffect(refresh);
  useEffect(() => onFormsChanged(refresh), [refresh]);

  const start = async (formId: string, job?: Job) => {
    const schema = findForm(formId);
    if (!schema || starting) return;
    setStarting(job?.id ?? formId);
    try {
      const entry = await startEntry(userId, schema, job ? { title: `${job.advert.title}${job.advert.employer ? `, ${job.advert.employer}` : ''}`, jobId: job.id, deadline: job.advert.deadline || undefined } : {});
      router.push(`/forms/${entry.id}` as Href);
    } finally {
      setStarting(null);
    }
  };

  const linked = new Set(entries.map((e) => e.jobId).filter(Boolean));
  const openJobs = jobs.filter((job) => !job.closed && job.status < 1 && !linked.has(job.id)).slice(0, 3);

  return (
    <Screen>
      <AppHeader title={t('forms.title')} />

      <View style={styles.hero}>
        <Ionicons name="sparkles" size={22} color="#FCD34D" />
        <Text style={styles.heroTitle}>{t('forms.heroTitle')}</Text>
        <Text style={styles.heroText}>{t('forms.heroText')}</Text>
      </View>

      <Text style={styles.heading}>{t('forms.myApplications')}</Text>
      {!entries.length && <Text style={styles.muted}>{t('forms.noneYet')}</Text>}
      {entries.map((entry) => {
        const schema = findForm(entry.formId);
        if (!schema) return null;
        const r = reasonAbout(schema, entry);
        return (
          <Pressable key={entry.id} onPress={() => router.push(`/forms/${entry.id}` as Href)} style={({ pressed }) => [styles.card, pressed && styles.dim]}>
            <View style={styles.cardHead}>
              <Ionicons name={schema.icon as never} size={20} color={Colors.primary} />
              <Text style={styles.cardTitle} numberOfLines={2}>
                {entry.title}
              </Text>
              <Text style={[styles.percent, r.ready && styles.good]}>{r.ready ? t('forms.ready') : t('forms.percent', { n: r.percent })}</Text>
            </View>
            <ReadinessBar percent={r.percent} ready={r.ready} />
            {!r.ready && r.next && (
              <Text style={styles.next} numberOfLines={2}>
                {t('forms.nextShort', { text: r.next.message })}
              </Text>
            )}
            <View style={styles.cardFoot}>
              <Text style={styles.muted}>{t('forms.updated', { date: shortDate(entry.updatedAt.slice(0, 10)) })}</Text>
              <Pressable onPress={() => deleteEntry(userId, entry.id)} hitSlop={8}>
                <Text style={styles.remove}>{t('forms.remove')}</Text>
              </Pressable>
              <Text style={styles.link}>{r.ready ? t('forms.open') : t('forms.continue')}</Text>
            </View>
          </Pressable>
        );
      })}

      <Text style={styles.heading}>{t('forms.start')}</Text>
      {forms.map((schema) => (
        <Pressable key={schema.id} onPress={() => start(schema.id)} style={({ pressed }) => [styles.startCard, pressed && styles.dim]}>
          <View style={styles.icon}>
            <Ionicons name={schema.icon as never} size={22} color={Colors.onDark} />
          </View>
          <View style={styles.startText}>
            <Text style={styles.cardTitle}>{schema.title}</Text>
            <Text style={styles.muted}>{schema.description}</Text>
          </View>
          <Ionicons name={starting === schema.id ? 'hourglass' : 'add-circle'} size={26} color={Colors.primary} />
        </Pressable>
      ))}
      {openJobs.length > 0 && (
        <View style={styles.fromJobs}>
          <Text style={styles.muted}>{t('forms.fromSavedJob')}</Text>
          {openJobs.map((job) => (
            <Pressable key={job.id} onPress={() => start('job_application', job)} style={({ pressed }) => [styles.chip, pressed && styles.dim]}>
              <Ionicons name="briefcase-outline" size={14} color={Colors.primary} />
              <Text style={styles.chipText} numberOfLines={1}>
                {job.advert.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={styles.small}>{t('forms.weNeverSubmit')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.lg, gap: 6 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: Colors.onDark },
  heroText: { fontSize: 14, lineHeight: 20, color: Colors.onDarkMuted },
  heading: { fontSize: 17, fontWeight: '700', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  small: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  percent: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  good: { color: Colors.success },
  next: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  remove: { fontSize: 13, color: Colors.textMuted },
  link: { marginLeft: 'auto', fontSize: 14, fontWeight: '700', color: Colors.primary },
  startCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  icon: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  startText: { flex: 1, gap: 2 },
  fromJobs: { gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: Colors.primarySoft, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  chipText: { fontSize: 14, color: Colors.primary, fontWeight: '600', flexShrink: 1 },
  dim: { opacity: 0.6 },
});
