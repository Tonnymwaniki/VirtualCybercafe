import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { govTasks, type GovTaskId } from '@/data/gov-tasks';
import { useAuth } from '@/lib/auth';
import { GUEST_ID, loadAllProgress } from '@/lib/gov-store';
import type { TaskProgress } from '@/lib/gov-types';

const taskColors: Record<GovTaskId, string> = {
  good_conduct: '#2563EB',
  kra_pin: '#16A34A',
  passport: '#6366F1',
  lost_id: '#F59E0B',
  driving_licence: '#EF4444',
  birth_certificate: '#14B8A6',
  sha: '#EC4899',
  business_name: '#22C55E',
  kra_returns: '#0EA5E9',
};

function statusText(stages: string[], progress: TaskProgress | undefined) {
  if (!progress || progress.stage < 0) return 'Not started';
  if (progress.stage >= stages.length - 1) return 'Done';
  return `Last step: ${stages[progress.stage]}`;
}

export default function GovernmentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [progress, setProgress] = useState<Partial<Record<GovTaskId, TaskProgress>>>({});

  useFocusEffect(
    useCallback(() => {
      loadAllProgress(user?.id ?? GUEST_ID).then(setProgress);
    }, [user]),
  );

  return (
    <Screen>
      <SubHeader title="Government Services" />
      <Text style={styles.intro}>
        Pick a task. I’ll check what you need, get your documents ready, fill in your answers and track it with you.
      </Text>

      <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => [styles.other, pressed && styles.dim]}>
        <Ionicons name="person-circle" size={18} color={Colors.primary} />
        <Text style={styles.otherText}>My Details: fill in once, every form reuses them</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </Pressable>

      <View style={styles.list}>
        {govTasks.map((task) => {
          const taskProgress = progress[task.id];
          const status = statusText(task.stages, taskProgress);
          const done = status === 'Done';
          return (
            <Pressable
              key={task.id}
              onPress={() => router.push(`/gov/${task.id}` as Href)}
              style={({ pressed }) => [styles.card, pressed && styles.dim]}>
              <IconBadge icon={task.icon} color={taskColors[task.id]} />
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{task.title}</Text>
                <Text style={styles.cardDescription}>{task.description}</Text>
                <Text style={[styles.status, done && styles.statusDone, status !== 'Not started' && styles.statusActive]}>
                  {status}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push({ pathname: '/chat', params: { q: 'I need help with another government service' } })}
        style={({ pressed }) => [styles.other, pressed && styles.dim]}>
        <Ionicons name="chatbubbles" size={18} color={Colors.primary} />
        <Text style={styles.otherText}>Another service? Ask the attendant</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
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
  other: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  otherText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  dim: { opacity: 0.7 },
});
