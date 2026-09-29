import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { cvHtml, cvQuestions, letterHtml, type CvAnswers, type CvResponse } from '@/lib/cv';
import { requestCv } from '@/lib/cv-client';
import { useAuth } from '@/lib/auth';
import { sharePdfFromHtml } from '@/lib/images';
import { GUEST_ID, loadProfile, saveProfile } from '@/lib/profile-store';

const emptyAnswers = Object.fromEntries(cvQuestions.map((q) => [q.key, ''])) as CvAnswers;

export default function CvBuilderScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [answers, setAnswers] = useState<CvAnswers>(emptyAnswers);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<CvResponse | null>(null);
  const [writing, setWriting] = useState(false);

  // Start from My Details, so the contact questions are already answered.
  useEffect(() => {
    loadProfile(userId).then((profile) => {
      const known: Partial<CvAnswers> = {
        fullName: profile.fullName,
        phone: profile.phone,
        email: profile.email,
        location: profile.town || profile.county,
        experience: profile.experience,
        education: profile.education,
        skills: profile.skills,
      };
      setAnswers((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(known) as [keyof CvAnswers, string | undefined][]) {
          if (value && !next[key]) next[key] = value;
        }
        return next;
      });
      setDraft((current) => current || known.fullName || '');
    });
  }, [userId]);

  const question = cvQuestions[step];
  const done = step >= cvQuestions.length;

  const next = async (value: string) => {
    if (!question) return;
    const trimmed = value.trim();
    if (!trimmed && !question.optional) return;
    const updated = { ...answers, [question.key]: trimmed };
    setAnswers(updated);
    setDraft(step + 1 < cvQuestions.length ? updated[cvQuestions[step + 1].key] : '');
    setStep(step + 1);
    if (step + 1 === cvQuestions.length) {
      saveProfile(userId, {
        fullName: updated.fullName,
        phone: updated.phone,
        email: updated.email,
        experience: updated.experience,
        education: updated.education,
        skills: updated.skills,
      });
      setWriting(true);
      setResult(await requestCv(updated));
      setWriting(false);
    }
  };

  const back = () => {
    if (step === 0) return;
    setResult(null);
    setDraft(answers[cvQuestions[step - 1].key]);
    setStep(step - 1);
  };

  const startOver = () => {
    setAnswers(emptyAnswers);
    setResult(null);
    setDraft('');
    setStep(0);
  };

  return (
    <Screen>
      <SubHeader title="CV & Cover Letter" />

      {!done && question && (
        <>
          <Text style={styles.progressLabel}>
            {step + 1} of {cvQuestions.length}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((step + 1) / cvQuestions.length) * 100}%` }]} />
          </View>

          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{question.question}</Text>
          </View>

          <TextInput
            key={question.key}
            value={draft}
            onChangeText={setDraft}
            placeholder={question.placeholder}
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, question.multiline && styles.inputMultiline]}
            multiline={question.multiline}
            autoFocus
            onSubmitEditing={question.multiline ? undefined : () => next(draft)}
            returnKeyType={question.multiline ? 'default' : 'next'}
          />

          <View style={styles.row}>
            {step > 0 && <Button label="Back" variant="secondary" onPress={back} />}
            <Button
              label={question.optional && !draft.trim() ? 'Skip' : step + 1 === cvQuestions.length ? 'Write my CV' : 'Next'}
              onPress={() => next(draft)}
              disabled={!question.optional && !draft.trim()}
            />
          </View>
        </>
      )}

      {done && writing && (
        <View style={styles.writing}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.writingText}>Writing your CV and cover letter...</Text>
        </View>
      )}

      {done && result && (
        <>
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.successText}>
              Your CV and cover letter are ready.
              {result.mode === 'sample' ? ' (Written from a template until the AI is switched on.)' : ''}
            </Text>
          </View>

          <View style={styles.preview}>
            <Text style={styles.name}>{answers.fullName}</Text>
            <Text style={styles.headline}>{result.cv.headline}</Text>
            <Text style={styles.contact}>
              {[answers.phone, answers.email, answers.location].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.previewHeading}>Profile</Text>
            <Text style={styles.previewText}>{result.cv.summary}</Text>
            {result.cv.experience.length > 0 && <Text style={styles.previewHeading}>Experience</Text>}
            {result.cv.experience.map((job, index) => (
              <View key={index} style={styles.previewItem}>
                <Text style={styles.itemTitle}>{job.title}</Text>
                <Text style={styles.itemMeta}>{[job.organisation, job.period].filter(Boolean).join(' · ')}</Text>
                {job.bullets.map((bullet, i) => (
                  <Text key={i} style={styles.previewText}>
                    • {bullet}
                  </Text>
                ))}
              </View>
            ))}
            {result.cv.education.length > 0 && <Text style={styles.previewHeading}>Education</Text>}
            {result.cv.education.map((item, index) => (
              <View key={index} style={styles.previewItem}>
                <Text style={styles.itemTitle}>{item.qualification}</Text>
                <Text style={styles.itemMeta}>{[item.institution, item.year].filter(Boolean).join(' · ')}</Text>
              </View>
            ))}
            {result.cv.skills.length > 0 && <Text style={styles.previewHeading}>Skills</Text>}
            <Text style={styles.previewText}>{result.cv.skills.join(' · ')}</Text>
          </View>

          <View style={styles.row}>
            <Button label="CV (PDF)" icon="download" onPress={() => sharePdfFromHtml(cvHtml(result.cv, answers))} />
            <Button
              label="Letter (PDF)"
              icon="mail"
              variant="secondary"
              onPress={() => sharePdfFromHtml(letterHtml(result.cv, answers))}
            />
          </View>
          <Pressable onPress={back} style={styles.linkRow}>
            <Text style={styles.link}>Change my answers</Text>
          </Pressable>
          <Pressable onPress={startOver} style={styles.linkRow}>
            <Text style={styles.link}>Start a new CV</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressLabel: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.primarySoft, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.primary },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: 4,
    padding: Spacing.md,
  },
  bubbleText: { fontSize: 15, color: Colors.text, lineHeight: 21 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    color: Colors.text,
  },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.md },
  writing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  writingText: { fontSize: 15, color: Colors.text },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#EAF7EF',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  successText: { flex: 1, fontSize: 13, color: Colors.text },
  preview: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 4,
  },
  name: { fontSize: 20, fontWeight: '700', color: Colors.navy },
  headline: { fontSize: 15, color: Colors.text },
  contact: { fontSize: 13, color: Colors.textMuted },
  previewHeading: {
    marginTop: Spacing.md,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewItem: { marginTop: Spacing.xs },
  itemTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  itemMeta: { fontSize: 13, color: Colors.textMuted },
  previewText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  linkRow: { alignItems: 'center', paddingVertical: Spacing.xs },
  link: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
});
