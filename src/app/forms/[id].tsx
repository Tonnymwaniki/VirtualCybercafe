import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { DocumentField } from '@/components/forms/document-field';
import { FieldInput } from '@/components/forms/field-input';
import { FilePicker } from '@/components/forms/file-picker';
import { ReadinessCard } from '@/components/forms/readiness';
import { FormHelperPanel } from '@/components/gov/form-helper-panel';
import { Card, Note, openUrl } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { useEngine } from '@/components/workbench/engine';
import { SubHeader } from '@/components/sub-header';
import { Colors, Spacing } from '@/constants/theme';
import { findForm } from '@/data/forms';
import { jobPortalTask } from '@/data/job-portal';
import type { Profile } from '@/data/profile-fields';
import { useAuth } from '@/lib/auth';
import { fixDocument, inspect } from '@/lib/forms/documents';
import { reasonAbout } from '@/lib/forms/reason';
import { isFileField, isVisible, type FormEntry, type FormField, type FormFile } from '@/lib/forms/schema';
import { fromProfile, loadEntry, saveAnswersToProfile, saveEntry } from '@/lib/forms/store';
import type { HelperResponse } from '@/lib/gov-types';
import { useLanguage } from '@/lib/i18n';
import { lockerCategories, type LockerCategory } from '@/data/locker';
import { GUEST_ID, loadProfile, usesCloud } from '@/lib/profile-store';
import { explainError, type Explained } from '@/lib/workbench/explain';
import { lockerWorkFile, saveToLocker, type WorkFile } from '@/lib/workbench/files';
import { WorkbenchError } from '@/lib/workbench/pdf';

// One application in Form Intelligence: any form schema drawn as a form that
// reasons (why each field is asked, where the value came from, what's wrong
// and what to do next), with the form helper beside it.
export default function FormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { user, demoMode } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [entry, setEntry] = useState<FormEntry | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile>({});
  const [picking, setPicking] = useState<FormField | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const sectionTops = useRef<Record<string, number>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engine = useEngine();
  // Attached files held in memory while the screen is open, for fixing.
  const workFiles = useRef(new Map<string, WorkFile>());
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixProblems, setFixProblems] = useState<Record<string, Explained | null>>({});
  const hasLocker = !!user && (demoMode || usesCloud(userId));

  useEffect(() => {
    loadEntry(userId, id).then((found) => setEntry(found ?? null));
    loadProfile(userId).then(setProfile);
  }, [userId, id]);

  const schema = entry ? findForm(entry.formId) : undefined;
  const reasoning = useMemo(() => (schema && entry ? reasonAbout(schema, entry) : null), [schema, entry]);
  const fillable = useMemo(() => (schema && entry ? fromProfile(schema, entry, profile) : {}), [schema, entry, profile]);

  // Saves a moment after the last change, and puts typed details in My Details.
  const update = (change: (current: FormEntry) => FormEntry) => {
    setEntry((current) => {
      if (!current || !schema) return current;
      const next = change(current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveEntry(userId, next).catch(() => {});
        saveAnswersToProfile(userId, schema, next).catch(() => {});
      }, 700);
      return next;
    });
  };

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const setAnswer = (fieldId: string, value: string, source: FormEntry['sourceOf'][string] = 'typed') =>
    update((current) => ({ ...current, answers: { ...current.answers, [fieldId]: value }, sourceOf: { ...current.sourceOf, [fieldId]: source } }));

  const fillFromProfile = () =>
    update((current) => ({
      ...current,
      answers: { ...current.answers, ...fillable },
      sourceOf: { ...current.sourceOf, ...Object.fromEntries(Object.keys(fillable).map((key) => [key, 'profile' as const])) },
    }));

  const applyHelper = (response: HelperResponse) => {
    if (!response.updates.length) return;
    update((current) => ({
      ...current,
      answers: { ...current.answers, ...Object.fromEntries(response.updates.map((u) => [u.key, u.value])) },
      sourceOf: { ...current.sourceOf, ...Object.fromEntries(response.updates.map((u) => [u.key, 'typed' as const])) },
    }));
  };

  const setFile = (fieldId: string, file: FormFile | null) =>
    update((current) => {
      const { [fieldId]: _, ...files } = current.files;
      return { ...current, files: file ? { ...files, [fieldId]: file } : files };
    });

  // Measures the attached file, so the checks use the real file.
  const attach = async (field: FormField, file: FormFile, work: WorkFile | null) => {
    setFixProblems((current) => ({ ...current, [field.id]: null }));
    if (!work) return setFile(field.id, file);
    workFiles.current.set(file.path, work);
    setFile(field.id, { ...file, facts: await inspect(work) });
  };

  // The file again, from memory or the Locker.
  const loadWork = async (file: FormFile): Promise<WorkFile | null> => {
    const kept = workFiles.current.get(file.path);
    if (kept) return kept;
    if (file.path.startsWith('device:')) return null;
    const category = file.path.split('/')[1] as LockerCategory;
    return lockerWorkFile({
      path: file.path,
      name: file.name,
      mimeType: file.mimeType,
      bytes: file.bytes,
      category: lockerCategories.includes(category) ? category : 'Documents',
      createdAt: '',
    });
  };

  const fix = async (field: FormField) => {
    const file = entry?.files[field.id];
    if (!file || fixing) return;
    setFixing(field.id);
    setFixProblems((current) => ({ ...current, [field.id]: null }));
    try {
      const work = await loadWork(file);
      if (!work) throw new WorkbenchError(t('forms.attachAgain'));
      const result = await fixDocument(field, work, engine, entry?.limits?.[field.id]);
      let path = `device:${result.file.name}`;
      if (hasLocker) path = await saveToLocker(userId, result.file, field.document?.lockerCategory as LockerCategory | undefined);
      workFiles.current.set(path, result.file);
      setFile(field.id, {
        path,
        name: result.file.name,
        mimeType: result.file.mimeType,
        bytes: result.file.bytes.byteLength,
        facts: result.facts,
        fixedFrom: { name: file.name, bytes: file.facts?.bytes ?? file.bytes, type: file.facts?.type },
        notes: result.notes,
      });
    } catch (error) {
      setFixProblems((current) => ({ ...current, [field.id]: explainError(error, 'formFix', t, []) }));
    } finally {
      setFixing(null);
    }
  };

  const setLimit = (fieldId: string, kb: number) =>
    update((current) => {
      const { [fieldId]: _, ...limits } = current.limits ?? {};
      return { ...current, limits: kb ? { ...limits, [fieldId]: kb } : limits };
    });

  const go = (fieldId: string) => {
    setFocus(fieldId);
    const section = schema?.sections.find((s) => s.fields.some((f) => f.id === fieldId));
    const y = (section ? sectionTops.current[section.id] ?? 0 : 0) + (positions.current[fieldId] ?? 0);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  };

  if (entry === undefined) {
    return (
      <Screen>
        <SubHeader title={t('forms.title')} />
        <ActivityIndicator color={Colors.primary} />
      </Screen>
    );
  }
  if (!entry || !schema || !reasoning) {
    return (
      <Screen>
        <SubHeader title={t('forms.title')} />
        <Note tone="warn">{t('forms.notFound')}</Note>
        <Button label={t('forms.backToList')} onPress={() => router.replace('/forms')} />
      </Screen>
    );
  }

  const fillCount = Object.keys(fillable).length;

  return (
    <Screen scrollRef={scrollRef}>
      <SubHeader title={schema.title} />
      <View style={styles.intro}>
        {entry.title !== schema.title && <Text style={styles.entryTitle}>{entry.title}</Text>}
        {!!entry.deadline && <Text style={styles.muted}>{t('forms.deadline', { date: entry.deadline })}</Text>}
      </View>

      <ReadinessCard reasoning={reasoning} onGo={go} />

      {reasoning.risks.map((risk) => (
        <Note key={risk.message} tone="warn">
          {risk.message}
        </Note>
      ))}

      {fillCount > 0 && (
        <View style={styles.fill}>
          <Text style={styles.fillText}>{t(fillCount === 1 ? 'forms.canFillOne' : 'forms.canFill', { n: fillCount })}</Text>
          <Button label={t('forms.fillNow')} icon="flash" variant="secondary" onPress={fillFromProfile} />
        </View>
      )}

      {schema.sections.map((section) => (
        <View key={section.id} onLayout={(e) => (sectionTops.current[section.id] = e.nativeEvent.layout.y)}>
          <Card title={section.title}>
            {!!section.why && <Text style={styles.sectionWhy}>{section.why}</Text>}
            {section.fields
              .filter((field) => isVisible(field, entry.answers))
              .map((field) => (
                <View key={field.id} onLayout={(e) => (positions.current[field.id] = e.nativeEvent.layout.y)}>
                  <FieldInput
                    field={field}
                    value={entry.answers[field.id] ?? ''}
                    result={reasoning.fields[field.id]}
                    source={entry.sourceOf[field.id]}
                    file={entry.files[field.id]}
                    highlight={focus === field.id}
                    onChange={(value) => setAnswer(field.id, value)}
                    onPickFile={() => setPicking(field)}
                    onRemoveFile={() => setFile(field.id, null)}
                    document={
                      isFileField(field) ? (
                        <DocumentField
                          field={field}
                          file={entry.files[field.id]}
                          limitKB={entry.limits?.[field.id]}
                          fixing={fixing === field.id}
                          fixProblem={fixProblems[field.id]}
                          onPick={() => setPicking(field)}
                          onRemove={() => setFile(field.id, null)}
                          onFix={() => fix(field)}
                          onLimit={(kb) => setLimit(field.id, kb)}
                        />
                      ) : undefined
                    }
                  />
                </View>
              ))}
          </Card>
        </View>
      ))}

      {!!schema.rejectionReasons?.length && (
        <Card title={t('forms.turnedDown')}>
          {schema.rejectionReasons.map((item) => (
            <View key={item.reason} style={styles.reason}>
              <Text style={styles.reasonTitle}>• {item.reason}</Text>
              <Text style={styles.muted}>{item.avoid}</Text>
            </View>
          ))}
          <Text style={styles.small}>{t('forms.sources', { list: schema.sources.map((source) => source.label).join(', '), date: schema.sources[0]?.checked ?? '' })}</Text>
        </Card>
      )}

      {schema.id === 'job_application' && (
        <FormHelperPanel task={jobPortalTask} values={entry.answers} profile={profile} lockerFiles={Object.values(entry.files).map((f) => f.name)} onResult={applyHelper} />
      )}

      {reasoning.ready ? (
        <Note tone="good">{t('forms.readyNote')}</Note>
      ) : (
        <Text style={styles.muted}>{t('forms.notReadyNote')}</Text>
      )}
      {schema.officialSite && (
        <Button
          label={t('forms.openOfficial')}
          icon="open-outline"
          variant={reasoning.ready ? 'primary' : 'secondary'}
          onPress={() => openUrl(schema.officialSite!.url)}
        />
      )}
      <Text style={styles.small}>{t('forms.weNeverSubmit')}</Text>

      <FilePicker
        field={picking}
        userId={userId}
        hasLocker={hasLocker}
        onClose={() => setPicking(null)}
        onPicked={(file, work) => {
          const field = picking;
          setPicking(null);
          if (field) attach(field, file, work).catch(() => setFile(field.id, file));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 2 },
  entryTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  small: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  sectionWhy: { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: Spacing.xs },
  fill: { gap: Spacing.sm, backgroundColor: Colors.primarySoft, borderRadius: 12, padding: Spacing.md },
  reason: { gap: 2, marginBottom: Spacing.xs },
  reasonTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  fillText: { fontSize: 14, color: Colors.navy, lineHeight: 19 },
});
