import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CheckRow, LinkButton, Note, openUrl } from '@/components/gov/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { deadlineLabel } from '@/lib/jobs-store';
import type { Job, JobAdvert, MatchResult } from '@/lib/jobs-types';

const methodLabels: Record<JobAdvert['howToApply']['method'], string> = {
  email: 'By email',
  portal: 'Online, on the employer’s website',
  in_person: 'Hand delivery',
  post: 'By post',
  unknown: 'Not clear from the advert',
};

export function ScamWarning({ advert }: { advert: JobAdvert }) {
  if (!advert.scamSignals.length) return null;
  return (
    <View style={styles.scam}>
      <View style={styles.scamHeader}>
        <Ionicons name="warning" size={20} color="#B91C1C" />
        <Text style={styles.scamTitle}>This advert may be a scam</Text>
      </View>
      {advert.scamSignals.map((signal) => (
        <Text key={signal} style={styles.scamText}>
          • {signal}
        </Text>
      ))}
      <Text style={styles.scamText}>
        Never pay to apply, train or get a job. Government and county jobs are free to apply for. Check the employer’s
        official website before you send anything.
      </Text>
    </View>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, index) => (
        <Text key={index} style={styles.item}>
          • {item}
        </Text>
      ))}
    </>
  );
}

// Step 1: what the advert says, read by the agent.
export function AdvertStep({ job, onDelete }: { job: Job; onDelete: () => void }) {
  const { advert } = job;
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <ScamWarning advert={advert} />
      <Card>
        <Text style={styles.title}>{advert.title}</Text>
        <Text style={styles.muted}>{[advert.employer, advert.location].filter(Boolean).join(' · ')}</Text>
        {!!advert.salary && <Text style={styles.item}>Pay: {advert.salary}</Text>}
        <Text style={styles.deadline}>
          {deadlineLabel(advert.deadline)}
          {advert.deadlineText ? ` · ${advert.deadlineText}` : ''}
        </Text>
      </Card>
      <Card title="How to apply">
        <Text style={styles.item}>{methodLabels[advert.howToApply.method]}</Text>
        {!!advert.howToApply.instructions && <Text style={styles.muted}>{advert.howToApply.instructions}</Text>}
        {!!advert.howToApply.email && <Text style={styles.item}>Email: {advert.howToApply.email}</Text>}
        {!!advert.howToApply.url && <LinkButton label="Open the application site" onPress={() => openUrl(advert.howToApply.url)} />}
      </Card>
      {advert.requirements.length > 0 && (
        <Card title="What they want">
          <List items={advert.requirements} />
        </Card>
      )}
      {advert.duties.length > 0 && (
        <Card title="What you’ll do">
          <List items={advert.duties} />
        </Card>
      )}
      {advert.documents.length > 0 && (
        <Card title="Documents to send">
          <List items={advert.documents} />
        </Card>
      )}
      {!!advert.sourceUrl && <LinkButton label="Open the original advert" onPress={() => openUrl(advert.sourceUrl)} />}
      <Note>I read this from the advert. Check the details against the original before you apply.</Note>
      <View style={styles.row}>
        <Button
          label={confirm ? 'Tap again to remove' : 'Remove this job'}
          icon="trash"
          variant="secondary"
          onPress={() => (confirm ? onDelete() : setConfirm(true))}
        />
      </View>
    </>
  );
}

const fitText: Record<MatchResult['fit'], { label: string; color: string }> = {
  strong: { label: 'Strong match', color: Colors.success },
  fair: { label: 'Fair match', color: Colors.warning },
  weak: { label: 'Weak match', color: '#B91C1C' },
};

type MatchProps = {
  job: Job;
  careerEmpty: boolean;
  checking: boolean;
  onCheck: () => void;
};

// Step 2: how the user's saved details compare with the advert.
export function MatchStep({ job, careerEmpty, checking, onCheck }: MatchProps) {
  const router = useRouter();
  const match = job.match;
  return (
    <>
      {careerEmpty && (
        <Note tone="warn">
          Your experience, education and skills aren’t saved yet. Add them once in My Details and every job uses them.
        </Note>
      )}
      {careerEmpty && <LinkButton label="Open My Details" icon="arrow-forward-circle" onPress={() => router.push('/profile')} />}
      {!match && (
        <Card title="Do you match this job?">
          <Text style={styles.muted}>
            I’ll compare the advert with your saved details and Locker, and show what matches and what’s missing.
          </Text>
        </Card>
      )}
      {match && (
        <>
          <Card>
            <View style={[styles.badge, { backgroundColor: fitText[match.fit].color }]}>
              <Text style={styles.badgeText}>{fitText[match.fit].label}</Text>
            </View>
            <Text style={styles.item}>{match.summary}</Text>
          </Card>
          {match.matches.length > 0 && (
            <Card title="What you have">
              {match.matches.map((item) => (
                <CheckRow key={item} label={item} checked />
              ))}
            </Card>
          )}
          {match.gaps.length > 0 && (
            <Card title="What’s missing">
              {match.gaps.map((gap) => (
                <CheckRow key={gap.item} label={gap.item} detail={gap.fix} checked={false} />
              ))}
            </Card>
          )}
          {match.documents.length > 0 && (
            <Card title="Documents">
              {match.documents.map((doc) => (
                <CheckRow
                  key={doc.name}
                  label={doc.name}
                  detail={
                    doc.inLocker
                      ? doc.name.match(/cv|cover letter/i)
                        ? 'I’ll write it in the next step'
                        : 'Found in your Locker'
                      : 'Not in your Locker yet'
                  }
                  checked={doc.inLocker}
                />
              ))}
              <LinkButton label="Open my Locker" icon="cloud-upload" onPress={() => router.push('/locker')} />
            </Card>
          )}
          {match.mode === 'sample' && <Note>This is a quick word check. The AI check reads your details more carefully.</Note>}
        </>
      )}
      <View style={styles.row}>
        <Button label={match ? 'Check again' : 'Check my match'} icon="git-compare" onPress={onCheck} busy={checking} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: Colors.navy },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  item: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  deadline: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  row: { flexDirection: 'row', gap: Spacing.md },
  scam: { backgroundColor: '#FEE2E2', borderRadius: Radius.lg, padding: Spacing.lg, gap: 6, borderWidth: 1, borderColor: '#FCA5A5' },
  scamHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scamTitle: { fontSize: 15, fontWeight: '700', color: '#B91C1C' },
  scamText: { fontSize: 13, color: '#7F1D1D', lineHeight: 19 },
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '700', color: Colors.onDark },
});
