import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DocActions } from '@/components/biz/doc-actions';
import { Button } from '@/components/button';
import { DetailsStep } from '@/components/gov/details-step';
import { Card, CheckRow, LinkButton, Note, openUrl } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { StepFooter, StepHeader } from '@/components/stepper';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Profile } from '@/data/profile-fields';
import { tripStages, visaFormTask } from '@/data/visa-form';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { documentHtml } from '@/lib/document-html';
import type { HelperAction } from '@/lib/gov-types';
import { listFiles, type StoredFile } from '@/lib/locker-store';
import { GUEST_ID, loadProfile, saveProfile } from '@/lib/profile-store';
import { deleteRecord, loadRecords, saveRecord } from '@/lib/record-store';
import { checkVisa, writeTripLetter } from '@/lib/travel-client';
import { passportWarning, tripCountdown } from '@/lib/travel-sample';
import {
  letterKindList,
  letterKinds,
  purposeLabel,
  TRIP_KEY,
  visaNeedLabel,
  type LetterKind,
  type Trip,
} from '@/lib/travel-types';


// Words that tie a required document to a Locker file name.
const lockerHints: [RegExp, RegExp][] = [
  [/passport valid|passport,|^passport/i, /^passport(?!-photo)|passport-bio|passport-page/i],
  [/photo/i, /passport-photo|photo/i],
  [/bank/i, /bank/i],
  [/invitation/i, /invitation/i],
  [/admission/i, /admission/i],
  [/good conduct|police/i, /good-conduct|police/i],
  [/ticket|flight/i, /ticket|flight|booking/i],
  [/cover letter/i, /cover-letter/i],
];

function inLocker(document: string, files: StoredFile[]) {
  const hint = lockerHints.find(([doc]) => doc.test(document));
  return hint ? files.find((f) => hint[1].test(f.name)) : undefined;
}

// One trip: the visa rules, documents, the visa form with the form helper,
// supporting letters and progress.
export default function TripScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile>({});
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [step, setStep] = useState(0);
  const { t } = useLanguage();
  const stepNames = ([1, 2, 3, 4, 5] as const).map((n) => t(`trip.step${n}`));
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  const [letterKind, setLetterKind] = useState<LetterKind>('cover');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadRecords<Trip>(userId, TRIP_KEY).then((records) => setTrip(records[id] ?? null));
    loadProfile(userId).then(setProfile);
    if (user) listFiles(user.id).then(setFiles).catch(() => {});
  }, [userId, id, user]);

  const update = useCallback(
    async (change: (current: Trip) => Trip) => {
      if (!trip) return;
      const next = change(trip);
      setTrip(next);
      await saveRecord(userId, TRIP_KEY, next.id, next);
    },
    [trip, userId],
  );

  if (trip === undefined) {
    return (
      <Screen>
        <SubHeader title="Trip" />
      </Screen>
    );
  }
  if (!trip) {
    return (
      <Screen>
        <SubHeader title="Trip" />
        <Note tone="warn">This trip was not found. It may have been deleted.</Note>
      </Screen>
    );
  }

  const runCheck = async () => {
    setBusy('check');
    setProblem('');
    const check = await checkVisa(trip.destination, trip.purpose);
    setBusy(null);
    if (!check) {
      setProblem('Couldn’t check right now. Check your connection and try again.');
      return;
    }
    await update((t) => ({ ...t, check, ready: [] }));
  };

  const writeLetter = async () => {
    setBusy('letter');
    setProblem('');
    const result = await writeTripLetter(letterKind, trip, profile, notes.trim());
    setBusy(null);
    if (!result.letter) {
      setProblem(result.problem);
      return;
    }
    if (result.problem) setProblem(result.problem);
    const letter = result.letter;
    await update((t) => ({ ...t, letters: { ...t.letters, [letterKind]: letter } }));
  };

  const saveForm = async (answers: Record<string, string>, profileChanges: Profile) => {
    const [saved] = await Promise.all([saveProfile(userId, profileChanges), update((t) => ({ ...t, formAnswers: answers }))]);
    setProfile(saved);
  };

  const helperAction = (action: HelperAction) => {
    if (action.type === 'open') router.push(action.route as Href);
    else if (action.type === 'stage') update((t) => ({ ...t, stage: Math.max(t.stage, action.stage) }));
  };

  const passportAlert = passportWarning(profile.passportExpiry ?? '', trip);
  const check = trip.check;
  const letter = trip.letters[letterKind];
  // Trip facts prefill the visa form.
  const formAnswers = {
    tripDestination: trip.destination,
    tripPurpose: purposeLabel[trip.purpose],
    arrivalDate: trip.departDate,
    departureDate: trip.returnDate,
    ...trip.formAnswers,
  };
  const portalTask = check?.officialUrl
    ? { ...visaFormTask, portal: { label: 'Open the official visa site', url: check.officialUrl } }
    : visaFormTask;

  return (
    <Screen scrollKey={step}>
      <SubHeader title={trip.destination} />
      <Text style={styles.muted}>
        {purposeLabel[trip.purpose]} · {[trip.departDate, trip.returnDate].filter(Boolean).join(' to ') || 'No dates yet'} ·{' '}
        {tripCountdown(trip.departDate)}
      </Text>
      {passportAlert && <Note tone="warn">{passportAlert}</Note>}
      {passportAlert && (
        <LinkButton label="Renew my passport" icon="arrow-forward-circle" onPress={() => router.push('/gov/passport' as Href)} />
      )}

      <StepHeader names={stepNames} step={step} onStep={setStep} />

      {step === 0 && (
        <Card title="Do I need a visa?">
          {!check && (
            <Text style={styles.body}>
              I’ll check the official immigration and embassy sites for what a Kenyan passport holder needs for this trip.
            </Text>
          )}
          {check && (
            <>
              <Text style={styles.need}>{visaNeedLabel[check.need]}</Text>
              {!!check.visaType && <Text style={styles.item}>{check.visaType}</Text>}
              <Text style={styles.body}>{check.summary}</Text>
              {!!check.fee && <Text style={styles.item}>Fee: {check.fee}</Text>}
              {!!check.processingTime && <Text style={styles.item}>Processing time: {check.processingTime}</Text>}
              {!!check.howToApply && <Text style={styles.body}>{check.howToApply}</Text>}
              {check.warnings.map((w) => (
                <Note key={w} tone="warn">
                  {w}
                </Note>
              ))}
              {!!check.officialUrl && <LinkButton label="Open the official visa site" onPress={() => openUrl(check.officialUrl)} />}
              {check.sources.length > 0 && (
                <Text style={styles.muted}>Sources: {check.sources.map((s) => s.title).join(', ')}</Text>
              )}
              <Text style={styles.muted}>
                Checked {new Date(check.checkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Rules
                change, so confirm on the official site before paying.
              </Text>
            </>
          )}
          <View style={styles.row}>
            <Button label={check ? 'Check again' : 'Check the rules'} icon="search" onPress={runCheck} busy={busy === 'check'} />
          </View>
          {!!problem && <Note tone="warn">{problem}</Note>}
          <Note>Only pay visa fees on the official site or at the official visa centre. Agents cannot guarantee a visa.</Note>
        </Card>
      )}

      {step === 1 && (
        <Card title="Documents to prepare">
          {!check && <Text style={styles.body}>Run the visa check first and I’ll list the documents for this trip.</Text>}
          {check?.documents.map((doc, index) => {
            const file = inLocker(doc, files);
            return (
              <CheckRow
                key={doc}
                label={doc}
                detail={file ? `In your Locker: ${file.name}` : undefined}
                checked={trip.ready.includes(index)}
                onToggle={() =>
                  update((t) => ({
                    ...t,
                    ready: t.ready.includes(index) ? t.ready.filter((i) => i !== index) : [...t.ready, index],
                  }))
                }
              />
            );
          })}
          <View style={styles.links}>
            <LinkButton label="Make a visa photo" icon="arrow-forward-circle" onPress={() => router.push('/studio/passport')} />
            <LinkButton label="Scan documents to PDF" icon="arrow-forward-circle" onPress={() => router.push('/studio/photos-to-pdf')} />
            <LinkButton label="Open my Locker" icon="cloud-upload" onPress={() => router.push('/locker')} />
            {trip.purpose === 'work' && (
              <LinkButton
                label="Certificate of Good Conduct"
                icon="arrow-forward-circle"
                onPress={() => router.push('/gov/good_conduct' as Href)}
              />
            )}
          </View>
        </Card>
      )}

      {step === 2 && (
        <DetailsStep
          task={portalTask}
          user={user}
          profile={profile}
          answers={formAnswers}
          onSave={saveForm}
          onAction={helperAction}
        />
      )}

      {step === 3 && (
        <>
          <Card title="Supporting letters">
            <View style={styles.chips}>
              {letterKindList.map((kind) => (
                <Pressable
                  key={kind}
                  onPress={() => {
                    setLetterKind(kind);
                    setNotes('');
                  }}
                  style={[styles.chip, letterKind === kind && styles.chipActive]}>
                  <Text style={[styles.chipText, letterKind === kind && styles.chipTextActive]}>{letterKinds[kind].label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.muted}>{letterKinds[letterKind].description}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={letterKinds[letterKind].question}
              placeholderTextColor={Colors.textMuted}
              multiline
              style={[styles.input, styles.multiline]}
            />
            <View style={styles.row}>
              <Button
                label={letter ? 'Write it again' : 'Write it'}
                icon="sparkles"
                onPress={writeLetter}
                busy={busy === 'letter'}
              />
            </View>
            {!!problem && <Note tone="warn">{problem}</Note>}
          </Card>
          {letter && (
            <Card title={letter.title}>
              <Text style={styles.body}>{letter.body}</Text>
              {letter.mode === 'sample' && <Note>This is a simple draft. Turn on the AI for a fully written letter.</Note>}
              <Note>Check every detail, fill any ________ and sign it before you use it.</Note>
              <DocActions
                html={documentHtml(letter.title, letter.body)}
                fileName={`${letterKind === 'cover' ? 'cover-letter' : letterKind === 'invitation' ? 'invitation-letter' : letterKind === 'sponsor' ? 'sponsor-letter' : 'itinerary'}-${trip.destination.replace(/[^\w]+/g, '-').toLowerCase()}.pdf`}
              />
            </Card>
          )}
        </>
      )}

      {step === 4 && (
        <Card title="Where are you?">
          {tripStages.map((stage, index) => (
            <CheckRow
              key={stage}
              label={stage}
              checked={trip.stage >= index}
              onToggle={() => update((t) => ({ ...t, stage: t.stage >= index ? index - 1 : index }))}
            />
          ))}
          {trip.stage >= 4 && <Note tone="good">Safe travels! Keep a copy of your visa and passport page in your Locker.</Note>}
        </Card>
      )}

      <StepFooter names={stepNames} step={step} onStep={setStep} />

      <View style={styles.row}>
        <Button
          label="Delete trip"
          icon="trash"
          variant="secondary"
          onPress={async () => {
            await deleteRecord(userId, TRIP_KEY, trip.id);
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  body: { fontSize: 14, color: Colors.text, lineHeight: 21 },
  item: { fontSize: 14, fontWeight: '600', color: Colors.text },
  need: { fontSize: 17, fontWeight: '700', color: Colors.navy },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  links: { gap: Spacing.sm, alignItems: 'flex-start' },
  tabs: { gap: Spacing.sm },
  tab: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  tabActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  tabTextActive: { color: Colors.onDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: Colors.onDark },
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
  multiline: { minHeight: 90, textAlignVertical: 'top' },
});
