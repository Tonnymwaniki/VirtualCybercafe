import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DocActions } from '@/components/biz/doc-actions';
import { Button } from '@/components/button';
import { Card, Note } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Profile } from '@/data/profile-fields';
import { writeBusinessDoc } from '@/lib/biz-client';
import { docFileName, docHtml } from '@/lib/biz-docs';
import { DOC_KEY, docKinds, isWrittenKind, type SavedDoc, type WriteBrief, type WrittenDoc, type WrittenKind } from '@/lib/biz-types';
import { useAuth } from '@/lib/auth';
import { GUEST_ID, loadProfile } from '@/lib/profile-store';
import { deleteRecord, loadRecords, newId, saveRecord } from '@/lib/record-store';

const questions: Record<WrittenKind, { key: keyof WriteBrief; label: string; placeholder: string; multiline?: boolean }[]> = {
  poster: [
    { key: 'topic', label: 'What do you want to advertise?', placeholder: 'e.g. Fresh milk and yoghurt delivered every morning' },
    { key: 'extra', label: 'Any offer or price? (optional)', placeholder: 'e.g. 1 litre at KSh 60, free delivery in town' },
  ],
  post: [
    { key: 'topic', label: 'What is the post about?', placeholder: 'e.g. New stock of school uniforms' },
    { key: 'extra', label: 'Any offer or price? (optional)', placeholder: 'e.g. 10% off this week' },
  ],
  plan: [
    { key: 'topic', label: 'What will you use the money for?', placeholder: 'e.g. Buy a second fridge and more stock' },
    { key: 'extra', label: 'How much do you need, and from whom?', placeholder: 'e.g. KSh 50,000 from Equity Bank, or Hustler Fund' },
    {
      key: 'details',
      label: 'Your sales, costs, customers and competitors, in your own words',
      placeholder: 'e.g. I sell about KSh 3,000 a day. Rent is 8,000 a month. Customers are estate families. Two other shops nearby.',
      multiline: true,
    },
  ],
};

// Posters, social media posts and business plans, written by the agent from
// the owner's answers and saved business details.
export default function WriteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; kind?: string; topic?: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;

  const [profile, setProfile] = useState<Profile>({});
  const [kind, setKind] = useState<WrittenKind>(params.kind && isWrittenKind(params.kind) ? params.kind : 'poster');
  const [brief, setBrief] = useState<WriteBrief>({ topic: params.topic?.slice(0, 200) ?? '', extra: '', details: '' });
  const [doc, setDoc] = useState<WrittenDoc | null>(null);
  const [writing, setWriting] = useState(false);
  const [problem, setProblem] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    loadProfile(userId).then(setProfile);
    if (params.id === 'new') return;
    loadRecords<SavedDoc>(userId, DOC_KEY).then((records) => {
      const found = records[params.id];
      if (found?.type !== 'written') return;
      setDoc(found.doc);
      setKind(found.doc.kind);
      setBrief(found.doc.brief);
    });
  }, [userId, params.id]);

  const write = async () => {
    setWriting(true);
    setProblem('');
    const result = await writeBusinessDoc(kind, brief, profile);
    setWriting(false);
    if (!result.content) {
      setProblem(result.problem);
      return;
    }
    if (result.problem) setProblem(result.problem);
    const next: WrittenDoc = {
      id: doc?.id ?? newId(),
      kind,
      brief,
      content: result.content,
      createdAt: doc?.createdAt ?? new Date().toISOString(),
      mode: result.mode,
    };
    await saveRecord<SavedDoc>(userId, DOC_KEY, next.id, { type: 'written', doc: next });
    setDoc(next);
    if (params.id === 'new') router.replace(`/business/write/${next.id}` as Href);
  };

  const copy = async (label: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(label);
  };

  const saved: SavedDoc | null = doc ? { type: 'written', doc } : null;
  const html = saved ? docHtml(saved, profile) : null;
  const content = doc?.content;
  const ready = kind === 'plan' ? !!brief.topic.trim() && !!brief.extra.trim() : !!brief.topic.trim();

  return (
    <Screen>
      <SubHeader title={docKinds[kind].label} />
      {!profile.businessName && (
        <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
          <Ionicons name="storefront" size={18} color={Colors.primary} />
          <Text style={styles.bannerText}>Add your business details in My Details so I can use them</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </Pressable>
      )}

      <Card title="Tell me about it">
        {questions[kind].map((q) => (
          <View key={q.key} style={styles.field}>
            <Text style={styles.label}>{q.label}</Text>
            <TextInput
              value={brief[q.key]}
              onChangeText={(text) => setBrief((b) => ({ ...b, [q.key]: text }))}
              placeholder={q.placeholder}
              placeholderTextColor={Colors.textMuted}
              multiline={q.multiline}
              style={[styles.input, q.multiline && styles.multiline]}
            />
          </View>
        ))}
        {kind === 'plan' && (
          <Note>I only use the figures you give me. Lenders check them, so keep them honest.</Note>
        )}
        <View style={styles.row}>
          <Button label={doc ? 'Write it again' : 'Write it'} icon="sparkles" onPress={write} busy={writing} disabled={!ready} />
        </View>
        {!!problem && <Note tone="warn">{problem}</Note>}
      </Card>

      {content?.kind === 'poster' && (
        <View style={styles.poster}>
          {!!profile.businessName && <Text style={styles.posterBusiness}>{profile.businessName.toUpperCase()}</Text>}
          <Text style={styles.posterHeadline}>{content.poster.headline}</Text>
          {!!content.poster.subheadline && <Text style={styles.posterSub}>{content.poster.subheadline}</Text>}
          {content.poster.points.map((p) => (
            <Text key={p} style={styles.posterPoint}>
              ✓ {p}
            </Text>
          ))}
          {!!content.poster.offer && <Text style={styles.posterOffer}>{content.poster.offer}</Text>}
          <Text style={styles.posterCta}>{content.poster.callToAction}</Text>
        </View>
      )}

      {content?.kind === 'post' && (
        <>
          {(
            [
              ['English', content.post.english],
              ['Kiswahili', content.post.swahili],
            ] as const
          ).map(([label, text]) => {
            const full = `${text}\n\n${content.post.hashtags.join(' ')}`.trim();
            return (
              <Card key={label} title={label}>
                <Text style={styles.body}>{full}</Text>
                <View style={styles.row}>
                  <Button
                    label={copied === label ? 'Copied' : 'Copy'}
                    icon="copy"
                    variant="secondary"
                    onPress={() => copy(label, full)}
                  />
                </View>
              </Card>
            );
          })}
        </>
      )}

      {content?.kind === 'plan' && (
        <Card title={content.plan.title}>
          {content.plan.sections.map((s) => (
            <View key={s.heading} style={styles.field}>
              <Text style={styles.heading}>{s.heading}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </Card>
      )}

      {doc?.mode === 'sample' && <Note>This is a simple draft. Turn on the AI for a fully written version.</Note>}

      {saved && html && (
        <Card title="Get the document">
          <DocActions html={html} fileName={docFileName(saved)} />
        </Card>
      )}

      {doc && (
        <View style={styles.row}>
          <Button
            label="Delete"
            icon="trash"
            variant="secondary"
            onPress={async () => {
              await deleteRecord(userId, DOC_KEY, doc.id);
              router.back();
            }}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  dim: { opacity: 0.7 },
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
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  heading: { fontSize: 15, fontWeight: '700', color: Colors.navy },
  body: { fontSize: 14, color: Colors.text, lineHeight: 21 },
  poster: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  posterBusiness: { color: Colors.onDark, fontSize: 13, fontWeight: '700', letterSpacing: 1, opacity: 0.85 },
  posterHeadline: { color: Colors.onDark, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  posterSub: { color: Colors.onDark, fontSize: 16, textAlign: 'center' },
  posterPoint: { color: Colors.onDark, fontSize: 15 },
  posterOffer: {
    backgroundColor: '#F59E0B',
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 18,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  posterCta: { color: Colors.onDark, fontSize: 16, fontWeight: '700', marginTop: Spacing.sm },
});
