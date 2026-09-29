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
import { validateAnswers, type Issue } from '@/lib/gov-validate';
import { pickImages, processImage } from '@/lib/images';
import { GUEST_ID, loadProfile, saveProfile } from '@/lib/profile-store';

// Everything checked here is optional: My Details only flags values that look wrong.
const checkFields = profileFields.map((field) => ({ ...field, optional: true }));

// "My Details": fill in once, and every form in the app reuses it.
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [values, setValues] = useState<Profile>({});
  const [reading, setReading] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
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
        ...(Object.keys(found).length ? [`Filled ${Object.keys(found).length} details from your ID. Check them, then save.`] : []),
        ...result.problems,
      ]);
      setSaved(false);
    } catch {
      setNotes(['Couldn’t read that photo. Try again in good light, or type your details.']);
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
      <SubHeader title="My Details" />
      <Text style={styles.intro}>
        Fill these in once. Every form in the app, and the form helper, uses them so you don’t type them again.
      </Text>

      {!user && (
        <Note tone="warn">
          You’re not signed in, so these stay on this phone only. Sign in to keep them safe in your private profile.
        </Note>
      )}

      <Card title="Import my old CV">
        <Text style={styles.intro}>Send your old CV and we fill in your career, education, skills and contacts. You check them before saving.</Text>
        <CvImport onFound={fillFromCv} />
      </Card>

      <Card title="Scan your ID">
        <PickButtons onPick={scanId} busy={reading} libraryLabel="Choose ID photo" />
        {notes.map((note) => (
          <Note key={note} tone={note.startsWith('Filled') ? 'good' : 'warn'}>
            {note}
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

      {saved && issues.length === 0 && <Note tone="good">Saved. Your forms will fill themselves from these.</Note>}
      {saved && issues.length > 0 && <Note tone="warn">Saved, but please check the details marked in red.</Note>}

      <View style={styles.row}>
        <Button label={saved ? 'Saved' : 'Save my details'} icon="save" onPress={save} busy={saving} />
      </View>
      {!user && (
        <View style={styles.row}>
          <Button label="Sign in" variant="secondary" onPress={() => router.push('/sign-in')} />
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
