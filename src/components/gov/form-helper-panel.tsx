import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { FormTask } from '@/data/gov-tasks';
import type { Profile } from '@/data/profile-fields';
import { askFormHelper } from '@/lib/gov-client';
import type { HelperAction, HelperMessage, HelperResponse } from '@/lib/gov-types';
import { validateAnswers } from '@/lib/gov-validate';
import { pickImages, processImage } from '@/lib/images';

type Props = {
  task: FormTask;
  values: Record<string, string>;
  profile: Profile;
  lockerFiles: string[];
  onResult: (response: HelperResponse) => void;
};

function actionLabel(action: HelperAction, task: FormTask) {
  if (action.type === 'open') return action.label;
  if (action.type === 'ready') {
    const requirement = task.requirements.find((r) => r.id === action.requirementId);
    return `Ticked: ${requirement?.label ?? 'requirement'}`;
  }
  return `Progress: ${task.stages[action.stage] ?? ''}`;
}

// The agent beside the form: the user asks, reports an error (typed or as a
// screenshot), and the helper fills fields and takes actions with them.
export function FormHelperPanel({ task, values, profile, lockerFiles, onResult }: Props) {
  const [messages, setMessages] = useState<(HelperMessage & { note?: string })[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMode, setErrorMode] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  const issues = validateAnswers(task.fields, values);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && !screenshot) || busy) return;
    const userText = trimmed || 'Here is a screenshot of the error I got.';
    const history = [...messages.map(({ role, text }) => ({ role, text })), { role: 'user' as const, text: userText }];
    setMessages((current) => [...current, { role: 'user', text: userText, note: screenshot ? 'Screenshot attached' : undefined }]);
    setDraft('');
    setBusy(true);
    const response = await askFormHelper({
      taskId: task.id,
      values,
      profile,
      lockerFiles,
      issues,
      messages: history,
      image: screenshot ?? undefined,
    });
    setScreenshot(null);
    setErrorMode(false);
    onResult(response);
    const changed = response.updates.length
      ? `Changed: ${response.updates.map((u) => task.fields.find((f) => f.key === u.key)?.label ?? u.key).join(', ')}`
      : undefined;
    const acted = response.actions.map((a) => actionLabel(a, task)).join(' · ') || undefined;
    setMessages((current) => [
      ...current,
      { role: 'assistant', text: response.reply, note: [changed, acted].filter(Boolean).join('\n') || undefined },
    ]);
    setBusy(false);
  };

  const attachScreenshot = async () => {
    const [photo] = await pickImages('library');
    if (!photo) return;
    const image = await processImage(photo, { maxSide: 1600, maxBytes: 1_500_000 });
    setScreenshot(image.base64);
  };

  const quick = [
    { label: 'Fill what you can', text: 'Fill in everything you can from my details, then tell me what is still missing.' },
    ...(issues.length ? [{ label: `Fix ${issues.length} problem${issues.length === 1 ? '' : 's'}`, text: 'Help me fix the problems on this form.' }] : []),
  ];

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={16} color={Colors.onDark} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Form helper</Text>
          <Text style={styles.subtitle}>I fill this in with you and fix errors from the site.</Text>
        </View>
      </View>

      {messages.map((message, index) => (
        <View key={index} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.helperBubble]}>
          <Text style={message.role === 'user' ? styles.userText : styles.helperText}>{message.text}</Text>
          {message.note && <Text style={message.role === 'user' ? styles.userNote : styles.helperNote}>{message.note}</Text>}
        </View>
      ))}
      {busy && <ActivityIndicator color={Colors.primary} style={styles.spinner} />}

      <View style={styles.chips}>
        {quick.map((chip) => (
          <Pressable key={chip.label} disabled={busy} onPress={() => send(chip.text)} style={({ pressed }) => [styles.chip, pressed && styles.dim]}>
            <Text style={styles.chipText}>{chip.label}</Text>
          </Pressable>
        ))}
        <Pressable
          disabled={busy}
          onPress={() => setErrorMode(!errorMode)}
          style={({ pressed }) => [styles.chip, styles.errorChip, (pressed || errorMode) && styles.dim]}>
          <Ionicons name="alert-circle" size={14} color="#B91C1C" />
          <Text style={[styles.chipText, styles.errorChipText]}>I got an error</Text>
        </Pressable>
      </View>

      {errorMode && (
        <View style={styles.errorBox}>
          <Text style={styles.errorHint}>Type the error message you see, or attach a screenshot of it.</Text>
          <Pressable onPress={attachScreenshot} style={({ pressed }) => [styles.attach, pressed && styles.dim]}>
            <Ionicons name={screenshot ? 'checkmark-circle' : 'image'} size={16} color={Colors.primary} />
            <Text style={styles.attachText}>{screenshot ? 'Screenshot attached' : 'Attach screenshot'}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => send(draft)}
          placeholder={errorMode ? 'e.g. “ID number and name do not match”' : 'Ask or tell me a detail...'}
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          returnKeyType="send"
        />
        <Pressable
          accessibilityLabel="Send to form helper"
          onPress={() => send(draft)}
          disabled={busy}
          style={({ pressed }) => [styles.send, (pressed || busy) && styles.dim]}>
          <Ionicons name="send" size={16} color={Colors.onDark} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textMuted },
  bubble: { maxWidth: '90%', borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  helperBubble: { alignSelf: 'flex-start', backgroundColor: Colors.background },
  userText: { fontSize: 14, color: Colors.onDark, lineHeight: 20 },
  helperText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  userNote: { fontSize: 12, color: Colors.onDarkMuted },
  helperNote: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  spinner: { alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  errorChip: { backgroundColor: '#FEE2E2' },
  errorChipText: { color: '#B91C1C' },
  errorBox: { gap: Spacing.sm },
  errorHint: { fontSize: 13, color: Colors.textMuted },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  attachText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.6 },
});
