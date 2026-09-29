import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Note, openUrl } from '@/components/gov/ui';
import { PickButtons } from '@/components/pick-buttons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { GovTask } from '@/data/gov-tasks';
import { readIdCard } from '@/lib/gov-client';
import type { IdDetails } from '@/lib/gov-types';
import { validateAnswers, type Issue } from '@/lib/gov-validate';
import { pickImages, processImage } from '@/lib/images';

type Props = {
  task: GovTask;
  idDetails: IdDetails;
  answers: Record<string, string>;
  onSave: (answers: Record<string, string>, idDetails: IdDetails) => Promise<void>;
};

// Step 3: the form answers, filled from the saved ID details or a photo of the
// ID, checked for mistakes, with a Copy button for each field.
export function DetailsStep({ task, idDetails, answers, onSave }: Props) {
  const initial = () =>
    Object.fromEntries(
      task.fields.map((field) => [
        field.key,
        answers[field.key] || (field.idField ? idDetails[field.idField] : '') || '',
      ]),
    );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [reading, setReading] = useState(false);
  const [readNotes, setReadNotes] = useState<string[]>([]);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Saved details arrive after the first render; fill any still-empty fields.
  useEffect(() => {
    setValues((current) => {
      const filled = initial();
      return Object.fromEntries(Object.entries(filled).map(([key, value]) => [key, current[key] || value]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDetails, answers]);

  const update = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setIssues(null);
  };

  const scanId = async (source: 'camera' | 'library') => {
    const [photo] = await pickImages(source);
    if (!photo) return;
    setReading(true);
    setReadNotes([]);
    try {
      const image = await processImage(photo, { maxSide: 1600, maxBytes: 1_500_000 });
      const result = await readIdCard(image.base64);
      const found = Object.keys(result.details).length;
      setValues((current) => {
        const next = { ...current };
        for (const field of task.fields) {
          const value = field.idField && result.details[field.idField];
          if (value) next[field.key] = value;
        }
        return next;
      });
      setReadNotes([
        ...(found ? [`Filled ${found} details from your ID. Check each one against the card.`] : []),
        ...result.problems,
      ]);
      setSaved(false);
    } catch {
      setReadNotes(['Couldn’t read that photo. Try again in good light, or type your details.']);
    } finally {
      setReading(false);
    }
  };

  const saveAndCheck = async () => {
    setSaving(true);
    const nextId = { ...idDetails };
    for (const field of task.fields) {
      if (field.idField) nextId[field.idField] = values[field.key]?.trim() ?? '';
    }
    await onSave(values, nextId);
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
          Take a clear photo of the front of your National ID. The details are saved to your private profile, so you only do this once.
        </Text>
        <PickButtons onPick={scanId} busy={reading} libraryLabel="Choose ID photo" />
        {readNotes.map((note) => (
          <Note key={note} tone={note.startsWith('Filled') ? 'good' : 'warn'}>
            {note}
          </Note>
        ))}
      </Card>

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
                  style={[styles.input, issue && styles.inputIssue]}
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
