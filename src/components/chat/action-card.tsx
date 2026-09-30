import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { findGovTask, type GovTaskId } from '@/data/gov-tasks';
import { taskColors } from '@/data/task-colors';
import { useAuth } from '@/lib/auth';
import { failureText } from '@/lib/failure';
import { runAction, undoAction } from '@/lib/chat-actions';
import type { ActionState, ProposedAction } from '@/lib/chat-types';
import { shortDate } from '@/lib/continue';
import { useLanguage } from '@/lib/i18n';
import { LockerFullError } from '@/lib/locker-store';
import { GUEST_ID } from '@/lib/profile-store';
import { purposeLabel } from '@/lib/travel-types';

type IconName = ComponentProps<typeof Ionicons>['name'];

function look(action: ProposedAction, t: ReturnType<typeof useLanguage>['t']): { icon: IconName; color: string; title: string } {
  switch (action.kind) {
    case 'details':
      return { icon: 'person-circle', color: '#0EA5E9', title: t('action.details') };
    case 'task': {
      const task = findGovTask(action.taskId);
      return {
        icon: task?.icon ?? 'document-text',
        color: taskColors[action.taskId as GovTaskId] ?? Colors.primary,
        title: t('action.task', { task: action.title }),
      };
    }
    case 'job':
      return { icon: 'briefcase', color: '#EF4444', title: t('action.job') };
    case 'trip':
      return { icon: 'airplane', color: '#6366F1', title: t('action.trip', { place: action.destination }) };
    case 'reminder':
      return { icon: 'alarm', color: '#F59E0B', title: t('action.reminder') };
  }
}

function rows(action: ProposedAction): [string, string][] {
  switch (action.kind) {
    case 'details':
      return action.fields.map((f) => [f.label, f.value]);
    case 'task':
      return action.answers.map((a) => [a.label, a.value]);
    case 'job': {
      const a = action.advert;
      return [
        ['Job', a.title],
        ['Employer', a.employer],
        ['Location', a.location],
        ['Deadline', a.deadline ? shortDate(a.deadline) : a.deadlineText],
        ['Apply', a.howToApply.email || a.howToApply.url || a.howToApply.instructions],
      ].filter(([, v]) => v) as [string, string][];
    }
    case 'trip':
      return [
        ['Purpose', purposeLabel[action.purpose]],
        ['Leaving', action.departDate ? shortDate(action.departDate) : ''],
        ['Back', action.returnDate ? shortDate(action.returnDate) : ''],
      ].filter(([, v]) => v) as [string, string][];
    case 'reminder':
      return [
        [action.title, shortDate(action.date)],
      ];
  }
}

// An action the attendant offers ("Save your KRA PIN to My Details?").
// Nothing happens until "Do it"; afterwards the card offers Open and Undo.
export function ActionCard({
  action,
  state,
  lockerNames,
  onChange,
}: {
  action: ProposedAction;
  state?: ActionState;
  lockerNames: string[];
  onChange: (state: ActionState | undefined) => void;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const { icon, color, title } = look(action, t);
  const done = state?.status === 'done';

  const act = async (work: () => Promise<ActionState | undefined>) => {
    setBusy(true);
    setFailed('');
    try {
      onChange(await work());
    } catch (error) {
      setFailed(error instanceof LockerFullError ? error.message : failureText(t('action.failedLead'), error));
    } finally {
      setBusy(false);
    }
  };

  const warnings = action.kind === 'job' ? action.advert.scamSignals : [];

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: color }]}>
          <Ionicons name={icon} size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>

      {rows(action).map(([label, value], index) => (
        <View key={index} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
      {action.kind === 'task' && !done && <Text style={styles.hint}>{t('action.taskHint')}</Text>}
      {warnings.map((warning) => (
        <View key={warning} style={styles.warning}>
          <Ionicons name="warning" size={14} color="#DC2626" />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ))}

      {!!failed && <Text style={styles.failed}>{failed}</Text>}

      {busy ? (
        <ActivityIndicator color={Colors.primary} style={styles.spinner} />
      ) : done ? (
        <View style={styles.doneBlock}>
          <View style={styles.doneRow}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.doneText}>
              {action.kind === 'task' && state?.note && state.note !== '0'
                ? t('action.doneTicked', { n: state.note })
                : t('action.done')}
            </Text>
          </View>
          <View style={styles.buttons}>
            {!!state?.route && (
              <Pressable onPress={() => router.push(state.route as Href)} style={[styles.button, styles.primary]}>
                <Text style={styles.primaryText}>{t('action.open')}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => act(() => undoAction(userId, action, state!))} style={styles.button}>
              <Ionicons name="arrow-undo" size={14} color={Colors.primary} />
              <Text style={styles.buttonText}>{t('action.undo')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.buttons}>
          {state && <Text style={styles.muted}>{state.status === 'undone' ? t('action.undone') : t('action.skipped')}</Text>}
          <Pressable onPress={() => act(() => runAction(userId, action, lockerNames))} style={[styles.button, styles.primary]}>
            <Ionicons name="checkmark" size={16} color={Colors.onDark} />
            <Text style={styles.primaryText}>{t('action.do')}</Text>
          </Pressable>
          {!state && (
            <Pressable onPress={() => onChange({ status: 'dismissed' })} style={styles.button}>
              <Text style={styles.buttonText}>{t('action.notNow')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardDone: { borderStyle: 'solid', borderColor: Colors.success },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  icon: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  row: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { width: '40%', fontSize: 13, color: Colors.textMuted },
  value: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  hint: { fontSize: 12, color: Colors.textMuted },
  warning: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 12, color: '#7F1D1D' },
  failed: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  spinner: { alignSelf: 'flex-start', marginVertical: Spacing.xs },
  doneBlock: { gap: Spacing.sm },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneText: { fontSize: 13, fontWeight: '700', color: Colors.success },
  buttons: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  buttonText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  primary: { backgroundColor: Colors.primary },
  primaryText: { fontSize: 13, fontWeight: '700', color: Colors.onDark },
  muted: { fontSize: 12, color: Colors.textMuted },
});
