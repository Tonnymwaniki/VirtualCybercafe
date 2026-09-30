import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { DetailsStep } from '@/components/gov/details-step';
import { Card, CheckRow, LinkButton, Note } from '@/components/gov/ui';
import { ScamWarning } from '@/components/jobs/advert-match-steps';
import { Colors, Spacing } from '@/constants/theme';
import { jobPortalTask } from '@/data/job-portal';
import type { Profile } from '@/data/profile-fields';
import type { AppUser } from '@/lib/auth';
import { CvDesignPicker, useCvDesign } from '@/components/cv/design-picker';
import { cvHtml, letterHtml } from '@/lib/cv';
import type { HelperAction } from '@/lib/gov-types';
import { sharePdfFromHtml } from '@/lib/images';
import { packHtml } from '@/lib/job-pack';
import { cvAnswersFor } from '@/lib/jobs-sample';
import type { Job } from '@/lib/jobs-types';
import { fileDataUrl, type StoredFile } from '@/lib/locker-store';
import { useLanguage } from '@/lib/i18n';
import { explainedText, explainError } from '@/lib/workbench/explain';

type CvProps = {
  job: Job;
  profile: Profile;
  careerEmpty: boolean;
  writing: boolean;
  onWrite: () => void;
};

// Step 3: a CV and cover letter written for this advert from My Details.
export function CvStep({ job, profile, careerEmpty, writing, onWrite }: CvProps) {
  const [design, setDesign] = useCvDesign();
  const router = useRouter();
  const application = job.application;
  const answers = cvAnswersFor(job.advert, profile);
  return (
    <>
      {careerEmpty && (
        <>
          <Note tone="warn">Add your experience, education and skills in My Details first, so the CV has something true to say.</Note>
          <LinkButton label="Open My Details" icon="arrow-forward-circle" onPress={() => router.push('/profile')} />
        </>
      )}
      {!application && (
        <Card title="A CV and letter for this job">
          <Text style={styles.muted}>
            I’ll use your saved details and put what this advert asks for first. I never add anything you haven’t told me.
          </Text>
        </Card>
      )}
      {application && (
        <>
          <Card title="CV">
            <Text style={styles.name}>{answers.fullName}</Text>
            <Text style={styles.headline}>{application.cv.headline}</Text>
            <Text style={styles.item}>{application.cv.summary}</Text>
            {application.cv.experience.map((item, index) => (
              <View key={index} style={styles.block}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.muted}>{[item.organisation, item.period].filter(Boolean).join(' · ')}</Text>
                {item.bullets.map((bullet, i) => (
                  <Text key={i} style={styles.item}>
                    • {bullet}
                  </Text>
                ))}
              </View>
            ))}
            {application.cv.skills.length > 0 && <Text style={styles.item}>Skills: {application.cv.skills.join(' · ')}</Text>}
          </Card>
          <Card title="Cover letter">
            <Text style={styles.item}>{application.cv.coverLetter}</Text>
          </Card>
          {application.mode === 'sample' && <Note>Written from a template until the AI is switched on.</Note>}
          <CvDesignPicker design={design} onChange={setDesign} />
          <View style={styles.row}>
            <Button label="CV (PDF)" icon="download" onPress={() => sharePdfFromHtml(cvHtml(application.cv, answers, design))} />
            <Button
              label="Letter (PDF)"
              icon="mail"
              variant="secondary"
              onPress={() => sharePdfFromHtml(letterHtml(application.cv, answers, design))}
            />
          </View>
        </>
      )}
      <View style={styles.row}>
        <Button
          label={application ? 'Write again' : 'Write my CV and letter'}
          icon="sparkles"
          variant={application ? 'secondary' : 'primary'}
          onPress={onWrite}
          busy={writing}
        />
      </View>
    </>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        await Clipboard.setStringAsync(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={styles.copy}
      hitSlop={6}>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? Colors.success : Colors.primary} />
      <Text style={styles.copyText}>{copied ? 'Copied' : label}</Text>
    </Pressable>
  );
}

type ApplyProps = {
  job: Job;
  user: AppUser | null;
  profile: Profile;
  lockerFiles: StoredFile[];
  onGoToCv: () => void;
  onSavePortal: (answers: Record<string, string>, profileChanges: Profile) => Promise<void>;
  onHelperAction: (action: HelperAction) => void;
  onApplied: () => void;
};

const isImage = (file: StoredFile) => file.mimeType.startsWith('image/');

// Step 4: the application pack, the email draft, and the form helper for
// online portals.
export function ApplyStep({ job, user, profile, lockerFiles, onGoToCv, onSavePortal, onHelperAction, onApplied }: ApplyProps) {
  const { t } = useLanguage();
  const [design] = useCvDesign();
  const router = useRouter();
  const { advert, application } = job;
  const how = advert.howToApply;
  const answers = cvAnswersFor(advert, profile);
  const attachable = useMemo(
    () => lockerFiles.filter((file) => file.category === 'Certificates' || file.category === 'ID' || file.category === 'Documents'),
    [lockerFiles],
  );
  // Files added to this job with "Use in application".
  const added = useMemo(() => new Set((job.documents ?? []).map((d) => d.path)), [job.documents]);
  const [picked, setPicked] = useState<string[]>(() =>
    lockerFiles.filter((file) => (file.category === 'Certificates' || file.category === 'ID' || added.has(file.path)) && isImage(file)).map((file) => file.path),
  );
  const [packing, setPacking] = useState(false);
  const [packProblem, setPackProblem] = useState('');

  const togglePick = (path: string) =>
    setPicked((current) => (current.includes(path) ? current.filter((p) => p !== path) : [...current, path]));

  const makePack = async () => {
    if (!application) return;
    setPacking(true);
    setPackProblem('');
    try {
      const images = await Promise.all(
        attachable
          .filter((file) => picked.includes(file.path) && isImage(file))
          .map(async (file) => ({ name: file.name, dataUrl: await fileDataUrl(file) })),
      );
      await sharePdfFromHtml(packHtml(application.cv, answers, images, design));
    } catch (error) {
      setPackProblem(explainedText(explainError(error, 'jobPack', t)));
    } finally {
      setPacking(false);
    }
  };

  const email = application?.email;
  const openEmail = () => {
    if (!email) return;
    const url = `mailto:${how.email}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    if (Platform.OS === 'web') window.location.href = url;
    else Linking.openURL(url);
  };

  const showEmail = !!how.email || how.method === 'email';
  const portalUrl = how.url || advert.sourceUrl;
  const showPortal = how.method === 'portal' || (!showEmail && !!portalUrl) || how.method === 'unknown';
  const portalTask = { ...jobPortalTask, portal: { label: 'Open application site', url: portalUrl || jobPortalTask.portal.url } };

  return (
    <>
      <ScamWarning advert={advert} />

      {(advert.documents.length > 0 || !!job.documents?.length) && (
        <Card title="Supporting documents">
          {advert.documents.length > 0 && <Text style={styles.muted}>The advert asks for: {advert.documents.join(', ')}.</Text>}
          {(job.documents ?? []).map((document) => (
            <CheckRow key={document.path} label={document.name} detail="Added for this job, in your Locker" checked />
          ))}
          <Text style={styles.muted}>
            Get a file ready in the Document Workbench or the chat, then tap “Use in application” on the result to add it here.
          </Text>
          <LinkButton label="Open Document Workbench" icon="arrow-forward-circle" onPress={() => router.push('/studio')} />
        </Card>
      )}

      <Card title="Application pack">
        {!application ? (
          <>
            <Text style={styles.muted}>Write your CV and cover letter for this job first; the pack puts them together.</Text>
            <LinkButton label="Go to CV & letter" icon="arrow-forward-circle" onPress={onGoToCv} />
          </>
        ) : (
          <>
            <Text style={styles.muted}>Cover letter, CV and the certificates you tick, in one PDF.</Text>
            {attachable.length === 0 && (
              <Text style={styles.muted}>
                {user ? 'No certificates in your Locker yet.' : 'Sign in to add certificates from your Locker.'}
              </Text>
            )}
            {attachable.map((file) =>
              isImage(file) ? (
                <CheckRow
                  key={file.path}
                  label={file.name}
                  detail={added.has(file.path) ? 'Added for this job' : file.category}
                  checked={picked.includes(file.path)}
                  onToggle={() => togglePick(file.path)}
                />
              ) : (
                <CheckRow
                  key={file.path}
                  label={file.name}
                  detail={added.has(file.path) ? 'Added for this job. PDF: attach it separately' : 'PDF: attach it separately'}
                  checked={false}
                />
              ),
            )}
            {!!packProblem && <Note tone="warn">{packProblem}</Note>}
            <View style={styles.row}>
              <Button label="Make application pack (PDF)" icon="document-attach" onPress={makePack} busy={packing} />
            </View>
          </>
        )}
      </Card>

      {showEmail && (
        <Card title="Email to send">
          {!email ? (
            <Text style={styles.muted}>The email is written together with your CV and letter.</Text>
          ) : (
            <>
              <View style={styles.emailRow}>
                <Text style={styles.item}>To: {how.email || '(see advert)'}</Text>
                {!!how.email && <CopyButton text={how.email} label="Copy" />}
              </View>
              <View style={styles.emailRow}>
                <Text style={[styles.item, styles.flex]}>Subject: {email.subject}</Text>
                <CopyButton text={email.subject} label="Copy" />
              </View>
              <Text style={styles.item}>{email.body}</Text>
              <CopyButton text={email.body} label="Copy message" />
              <Note>Attach your application pack PDF before you send. Send it from your own email.</Note>
              {!!how.email && (
                <View style={styles.row}>
                  <Button label="Open my email app" icon="mail-open" variant="secondary" onPress={openEmail} />
                </View>
              )}
            </>
          )}
        </Card>
      )}

      {showPortal && (
        <>
          <Text style={styles.heading}>Applying online</Text>
          <DetailsStep
            task={portalTask}
            user={user}
            profile={profile}
            answers={job.portalAnswers ?? {}}
            onSave={onSavePortal}
            onAction={onHelperAction}
          />
        </>
      )}

      {how.method === 'in_person' || how.method === 'post' ? (
        <Note>Print your application pack and deliver it as the advert says, before the deadline. Keep a copy.</Note>
      ) : null}

      {job.status < 1 && (
        <View style={styles.row}>
          <Button label="I’ve applied" icon="checkmark-done" onPress={onApplied} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  item: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  name: { fontSize: 18, fontWeight: '700', color: Colors.navy },
  headline: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  block: { gap: 2, marginTop: Spacing.xs },
  heading: { fontSize: 17, fontWeight: '700', color: Colors.navy, marginTop: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  copyText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
});
