import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Note } from '@/components/gov/ui';
import { PickButtons } from '@/components/pick-buttons';
import { CvImport } from '@/components/profile/cv-import';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { cleanProfile, profileFields, profileSections, type Profile } from '@/data/profile-fields';
import { useAuth } from '@/lib/auth';
import { readIdCard } from '@/lib/gov-client';
import { useLanguage } from '@/lib/i18n';
import { validateAnswers, type Issue } from '@/lib/gov-validate';
import { pickImages, processImage } from '@/lib/images';
import { GUEST_ID, loadProfile, saveProfile } from '@/lib/profile-store';

// Everything checked here is optional: My Details only flags values that look wrong.
const checkFields = profileFields.map((field) => ({ ...field, optional: true }));

// "My Details": fill in once, and every form in the app reuses it.
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.id ?? GUEST_ID;
  const [values, setValues] = useState<Profile>({});
  const [reading, setReading] = useState(false);
  const [notes, setNotes] = useState<{ text: string; good?: boolean }[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadProfile(userId).then((profile) => setValues((current) => ({ ...profile, ...current })));
  }, [userId]);

  const update = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const scanId = async (source: 'camera' | 'library') => {
    const [photo] = await pickImages(source);
    if (!photo) return;
    setReading(true);
    try {
      const image = await processImage(photo, { maxSide: 1600, maxBytes: 1_500_000 });
      const result = await readIdCard(image.base64);
      const found = cleanProfile(result.details);
      setValues((current) => ({ ...current, ...found }));
      setNotes([
        ...(Object.keys(found).length ? [{ text: t('profile.idFilled', { n: Object.keys(found).length }), good: true }] : []),
        ...result.problems.map((text) => ({ text })),
      ]);
      setSaved(false);
    } catch {
      setNotes([{ text: t('profile.idFailed') }]);
    } finally {
      setReading(false);
    }
  };

  // Fills only details that are still empty, so nothing typed is lost.
  const fillFromCv = (details: Record<string, string>) => {
    const found = cleanProfile(details);
    const fresh = Object.fromEntries(Object.entries(found).filter(([key]) => !values[key as keyof Profile]?.trim()));
    setValues((current) => ({ ...current, ...fresh }));
    setSaved(false);
    return Object.keys(fresh).length;
  };

  const save = async () => {
    setSaving(true);
    const found = validateAnswers(checkFields, values);
    setIssues(found);
    // Empty strings clear details the user deleted.
    const changes = Object.fromEntries(profileFields.map((field) => [field.key, values[field.key]?.trim() ?? '']));
    setValues(await saveProfile(userId, changes));
    setSaved(true);
    setSaving(false);
  };

  return (
    <Screen>
      <SubHeader title={t('profile.title')} />
      <Text style={styles.intro}>{t('profile.intro')}</Text>

      {!user && (
        <Note tone="warn">{t('profile.guest')}</Note>
      )}

      <Card title={t('profile.importCv')}>
        <Text style={styles.intro}>{t('profile.importCvText')}</Text>
        <CvImport onFound={fillFromCv} />
      </Card>

      <Card title={t('profile.scanId')}>
        <PickButtons onPick={scanId} busy={reading} libraryLabel={t('profile.chooseId')} />
        {notes.map((note) => (
          <Note key={note.text} tone={note.good ? 'good' : 'warn'}>
            {note.text}
          </Note>
        ))}
      </Card>

      {profileSections.map((section) => (
        <Card key={section} title={section}>
          {profileFields
            .filter((field) => field.section === section)
            .map((field) => {
              const issue = issues.find((i) => i.key === field.key);
              return (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    value={values[field.key] ?? ''}
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
                    autoCapitalize={
                      field.kind === 'email' ? 'none' : field.kind === 'kraPin' ? 'characters' : field.multiline ? 'sentences' : 'words'
                    }
                    multiline={field.multiline}
                    style={[styles.input, field.multiline && styles.inputMultiline, issue && styles.inputIssue]}
                  />
                  {issue && <Text style={styles.issue}>{issue.message}</Text>}
                </View>
              );
            })}
        </Card>
      ))}

      {saved && issues.length === 0 && <Note tone="good">{t('profile.saved')}</Note>}
      {saved && issues.length > 0 && <Note tone="warn">{t('profile.savedCheck')}</Note>}

      <View style={styles.row}>
        <Button label={saved ? t('profile.savedButton') : t('profile.saveButton')} icon="save" onPress={save} busy={saving} />
      </View>
      {!user && (
        <View style={styles.row}>
          <Button label={t('common.signIn')} variant="secondary" onPress={() => router.push('/sign-in')} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  inputIssue: { borderColor: '#DC2626' },
  issue: { fontSize: 12, color: '#DC2626' },
  row: { flexDirection: 'row', gap: Spacing.md },
});
