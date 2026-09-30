import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ReadinessBar } from '@/components/forms/readiness';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { findForm } from '@/data/forms';
import { reasonAbout } from '@/lib/forms/reason';
import type { FormEntry } from '@/lib/forms/schema';
import { loadEntries, onFormsChanged, startEntry } from '@/lib/forms/store';
import { useLanguage } from '@/lib/i18n';
import type { Job } from '@/lib/jobs-types';

// Form Intelligence inside the Jobs Apply step: how ready this job's
// application is, and a button to open (or start) it.
export function FormLink({ job, userId }: { job: Job; userId: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [entry, setEntry] = useState<FormEntry | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () =>
      loadEntries(userId)
        .then((list) => setEntry(list.find((e) => e.jobId === job.id) ?? null))
        .catch(() => setEntry(null));
    load();
    return onFormsChanged(load);
  }, [userId, job.id]);

  const schema = findForm('job_application');
  if (entry === undefined || !schema) return null;
  const r = entry ? reasonAbout(schema, entry) : null;

  const open = async () => {
    if (entry) return router.push(`/forms/${entry.id}` as Href);
    setBusy(true);
    try {
      const { advert } = job;
      const created = await startEntry(userId, schema, {
        title: `${advert.title}${advert.employer ? `, ${advert.employer}` : ''}`,
        jobId: job.id,
        deadline: advert.deadline || undefined,
      });
      router.push(`/forms/${created.id}` as Href);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable onPress={open} disabled={busy} style={({ pressed }) => [styles.card, (pressed || busy) && styles.dim]}>
      <View style={styles.head}>
        <Ionicons name="sparkles" size={20} color="#FCD34D" />
        <Text style={styles.title}>{r ? t('forms.linkReady', { n: r.percent }) : t('forms.linkStart')}</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.onDark} />
      </View>
      {r ? <ReadinessBar percent={r.percent} ready={r.ready} /> : <Text style={styles.text}>{t('forms.linkText')}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.onDark },
  text: { fontSize: 13, lineHeight: 18, color: Colors.onDarkMuted },
  dim: { opacity: 0.7 },
});
