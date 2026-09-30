import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { FormHelperPanel } from '@/components/gov/form-helper-panel';
import { Card, Note, openUrl } from '@/components/gov/ui';
import { PickButtons } from '@/components/pick-buttons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { FormTask } from '@/data/gov-tasks';
import { cleanProfile, isProfileKey, type Profile } from '@/data/profile-fields';
import type { AppUser } from '@/lib/auth';
import { readIdCard } from '@/lib/gov-client';
import type { HelperAction, HelperResponse } from '@/lib/gov-types';
import { validateAnswers, type Issue } from '@/lib/gov-validate';
import { pickImages, processImage } from '@/lib/images';
import { listFiles } from '@/lib/locker-store';
import { useLanguage } from '@/lib/i18n';
import { explainedText, explainError } from '@/lib/workbench/explain';

type Props = {
  task: FormTask;
  user: AppUser | null;
  profile: Profile;
  answers: Record<string, string>;
  // Saves the task's answers and merges profileChanges into My Details.
  onSave: (answers: Record<string, string>, profileChanges: Profile) => Promise<void>;
  onAction: (action: HelperAction) => void;
};

// Step 3: the form answers, filled from My Details or a photo of the ID,
// checked for mistakes, with a Copy button for each field and the form helper
// agent beside it.
export function DetailsStep({ task, user, profile, answers, onSave, onAction }: Props) {
  const initial = () =>
    Object.fromEntries(task.fields.map((field) => [field.key, answers[field.key] || profile[field.key] || '']));
  const { t } = useLanguage();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [reading, setReading] = useState(false);
  const [readNotes, setReadNotes] = useState<string[]>([]);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Details read from the ID that this form doesn't ask for, kept for My Details.
  const [scanned, setScanned] = useState<Profile>({});
  // Fields the helper changed, with the old value for Undo.
  const [changed, setChanged] = useState<Record<string, { previous: string; reason: string }>>({});
  const [lockerFiles, setLockerFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    listFiles(user.id)
      .then((files) => setLockerFiles(files.map((file) => `${file.category}/${file.name}`)))
      .catch(() => {});
  }, [user]);

  // Saved details arrive after the first render; fill any still-empty fields.
  useEffect(() => {
    setValues((current) => {
      const filled = initial();
      return Object.fromEntries(Object.entries(filled).map(([key, value]) => [key, current[key] || value]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, answers]);

  const update = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setChanged(({ [key]: _, ...rest }) => rest);
    setSaved(false);
    setIssues(null);
  };

  const applyHelper = (response: HelperResponse) => {
    if (response.updates.length) {
      setChanged((current) => {
        const next = { ...current };
        for (const u of response.updates) {
          next[u.key] = { previous: current[u.key]?.previous ?? values[u.key] ?? '', reason: u.reason };
        }
        return next;
      });
      setValues((current) => ({ ...current, ...Object.fromEntries(response.updates.map((u) => [u.key, u.value])) }));
      setSaved(false);
      setIssues(null);
    }
    response.actions.forEach(onAction);
  };

  const undo = (key: string) => {
    const previous = changed[key]?.previous ?? '';
    setValues((current) => ({ ...current, [key]: previous }));
    setChanged(({ [key]: _, ...rest }) => rest);
    setSaved(false);
  };

  const scanId = async (source: 'camera' | 'library') => {
    setReadNotes([]);
    try {
      const [photo] = await pickImages(source);
      if (!photo) return;
      setReading(true);
      const image = await processImage(photo, { maxSide: 1600, maxBytes: 1_500_000 });
      const result = await readIdCard(image.base64);
      const found = Object.keys(result.details).length;
      const details = result.details as Profile;
      setValues((current) => {
        const next = { ...current };
        for (const field of task.fields) {
          if (details[field.key]) next[field.key] = details[field.key];
        }
        return next;
      });
      setScanned((current) => ({ ...current, ...cleanProfile(details) }));
      setReadNotes([
        ...(found ? [`Filled ${found} details from your ID. Check each one against the card.`] : []),
        ...result.problems,
      ]);
      setSaved(false);
    } catch (error) {
      setReadNotes([explainedText(explainError(error, 'idScan', t))]);
    } finally {
      setReading(false);
    }
  };

  const saveAndCheck = async () => {
    setSaving(true);
    const fromForm = Object.fromEntries(
      task.fields.filter((field) => isProfileKey(field.key)).map((field) => [field.key, values[field.key]?.trim() ?? '']),
    );
    await onSave(values, { ...scanned, ...fromForm });
    setChanged({});
    setIssues(validateAnswers(task.fields, values));
    setSaved(true);
    setSaving(false);
  };

  const copy = async (key: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(key);
    setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
  };

  const copyAll = () =>
    copy(
      '__all',
      task.fields
        .filter((field) => values[field.key]?.trim())
        .map((field) => `${field.label}: ${values[field.key].trim()}`)
        .join('\n'),
    );

  const issueFor = (key: string) => issues?.find((issue) => issue.key === key);

  return (
    <>
      <Card title="Scan your ID to fill this in">
        <Text style={styles.muted}>
          Take a clear photo of the front of your National ID. Your details are saved to My Details, so every form can reuse them.
        </Text>
        <PickButtons onPick={scanId} busy={reading} libraryLabel="Choose ID photo" />
        {readNotes.map((note) => (
          <Note key={note} tone={note.startsWith('Filled') ? 'good' : 'warn'}>
            {note}
          </Note>
        ))}
      </Card>

      <FormHelperPanel task={task} values={values} profile={{ ...profile, ...scanned }} lockerFiles={lockerFiles} onResult={applyHelper} />

      <Card title="Your answers for the form">
        {task.fields.map((field) => {
          const issue = issueFor(field.key);
          const value = values[field.key] ?? '';
          return (
            <View key={field.key} style={styles.field}>
              <Text style={styles.label}>
                {field.label}
                {field.optional ? <Text style={styles.muted}> (optional)</Text> : null}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={value}
                  onChangeText={(text) => update(field.key, text)}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={
                    field.kind === 'phone' || field.kind === 'idNumber'
                      ? 'phone-pad'
                      : field.kind === 'email'
                        ? 'email-address'
                        : 'default'
                  }
                  autoCapitalize={field.kind === 'email' ? 'none' : 'words'}
                  style={[styles.input, changed[field.key] && styles.inputChanged, issue && styles.inputIssue]}
                />
                <Pressable
                  accessibilityLabel={`Copy ${field.label}`}
                  disabled={!value.trim()}
                  onPress={() => copy(field.key, value.trim())}
                  hitSlop={6}
                  style={({ pressed }) => [styles.copy, (pressed || !value.trim()) && styles.dim]}>
                  <Ionicons
                    name={copied === field.key ? 'checkmark' : 'copy-outline'}
                    size={18}
                    color={copied === field.key ? Colors.success : Colors.primary}
                  />
                </Pressable>
              </View>
              {issue && <Text style={styles.issue}>{issue.message}</Text>}
              {changed[field.key] && (
                <View style={styles.changedRow}>
                  <Ionicons name="sparkles" size={12} color={Colors.primary} />
                  <Text style={styles.changedText}>Helper: {changed[field.key].reason}</Text>
                  <Pressable onPress={() => undo(field.key)} hitSlop={6}>
                    <Text style={styles.undo}>Undo</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {issues && (issues.length === 0 ? (
        <Note tone="good">Everything looks right. Copy each answer into the form on {task.portal.label.replace(/^Open /, '')}.</Note>
      ) : (
        <Note tone="warn">{`Please fix ${issues.length} thing${issues.length === 1 ? '' : 's'} marked in red above.`}</Note>
      ))}

      <View style={styles.row}>
        <Button label={saved ? 'Saved' : 'Save and check'} icon="shield-checkmark" onPress={saveAndCheck} busy={saving} />
      </View>
      <View style={styles.row}>
        <Button label={copied === '__all' ? 'Copied' : 'Copy all'} icon="copy" variant="secondary" onPress={copyAll} />
        <Button label={task.portal.label} icon="open-outline" variant="secondary" onPress={() => openUrl(task.portal.url)} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputIssue: { borderColor: '#DC2626' },
  inputChanged: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  changedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changedText: { flex: 1, fontSize: 12, color: Colors.primary },
  undo: { fontSize: 12, fontWeight: '700', color: Colors.primary, textDecorationLine: 'underline' },
  copy: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  issue: { fontSize: 12, color: '#DC2626' },
  row: { flexDirection: 'row', gap: Spacing.md },
  dim: { opacity: 0.5 },
});
