import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { bizTasks, type GovTaskId } from '@/data/gov-tasks';
import type { Profile } from '@/data/profile-fields';
import { taskColors } from '@/data/task-colors';
import { docDate, docId, docTitle } from '@/lib/biz-docs';
import { DOC_KEY, docKinds, TENDER_KEY, billKinds, writtenKinds, type DocKind, type SavedDoc, type SavedTender } from '@/lib/biz-types';
import { useAuth } from '@/lib/auth';
import { GUEST_ID, loadAllProgress } from '@/lib/gov-store';
import type { TaskProgress } from '@/lib/gov-types';
import { loadProfile } from '@/lib/profile-store';
import { loadRecords } from '@/lib/record-store';

type IconName = ComponentProps<typeof Ionicons>['name'];

function statusText(stages: string[], progress: TaskProgress | undefined) {
  if (!progress || progress.stage < 0) return 'Not started';
  if (progress.stage >= stages.length - 1) return 'Done';
  return `Last step: ${stages[progress.stage]}`;
}

const kindColors: Record<DocKind, string> = {
  invoice: '#2563EB',
  receipt: '#16A34A',
  quotation: '#6366F1',
  pricelist: '#F59E0B',
  poster: '#EF4444',
  post: '#22C55E',
  plan: '#0EA5E9',
};

function docKind(saved: SavedDoc): DocKind {
  return saved.type === 'bill' ? saved.bill.kind : saved.doc.kind;
}

// The Business workspace: registration and tax tasks, business documents
// and tenders, all filled from My Details > Business.
export default function BusinessScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [progress, setProgress] = useState<Partial<Record<GovTaskId, TaskProgress>>>({});
  const [profile, setProfile] = useState<Profile>({});
  const [docs, setDocs] = useState<SavedDoc[]>([]);
  const [tenders, setTenders] = useState<SavedTender[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadAllProgress(userId).then(setProgress);
      loadProfile(userId).then(setProfile);
      loadRecords<SavedDoc>(userId, DOC_KEY).then((records) =>
        setDocs(Object.values(records).sort((a, b) => docDate(b).localeCompare(docDate(a)))),
      );
      loadRecords<SavedTender>(userId, TENDER_KEY).then((records) => setTenders(Object.values(records)));
    }, [userId]),
  );

  const openDoc = (kind: DocKind, id = 'new') =>
    router.push(
      (billKinds as DocKind[]).includes(kind)
        ? (`/business/bill/${id}${id === 'new' ? `?kind=${kind}` : ''}` as Href)
        : (`/business/write/${id}${id === 'new' ? `?kind=${kind}` : ''}` as Href),
    );

  const openTenders = tenders.filter((t) => t.status < 3).length;

  return (
    <Screen>
      <SubHeader title="Business" />
      <Text style={styles.intro}>
        Register and stay compliant, make invoices and adverts, and find government tenders, with your business details filled in for
        you.
      </Text>

      <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
        <Ionicons name="storefront" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>
          {profile.businessName ? `My Business: ${profile.businessName}` : 'My Business: add your business details once (My Details)'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </Pressable>

      <Text style={styles.heading}>Register and comply</Text>
      <View style={styles.list}>
        {bizTasks.map((task) => {
          const status = statusText(task.stages, progress[task.id]);
          return (
            <Pressable
              key={task.id}
              onPress={() => router.push(`/gov/${task.id}` as Href)}
              style={({ pressed }) => [styles.card, pressed && styles.dim]}>
              <IconBadge icon={task.icon} color={taskColors[task.id]} />
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{task.title}</Text>
                <Text style={styles.cardDescription}>{task.description}</Text>
                <Text style={[styles.status, status !== 'Not started' && styles.statusActive, status === 'Done' && styles.statusDone]}>
                  {status}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.heading}>Make a document</Text>
      <View style={styles.grid}>
        {[...billKinds, ...writtenKinds].map((kind) => (
          <Pressable key={kind} onPress={() => openDoc(kind)} style={({ pressed }) => [styles.tile, pressed && styles.dim]}>
            <IconBadge icon={docKinds[kind].icon as IconName} color={kindColors[kind]} />
            <Text style={styles.tileTitle}>{docKinds[kind].label}</Text>
            <Text style={styles.tileText}>{docKinds[kind].description}</Text>
          </Pressable>
        ))}
      </View>

      {docs.length > 0 && (
        <>
          <Text style={styles.heading}>My documents</Text>
          <View style={styles.list}>
            {docs.slice(0, 20).map((saved) => {
              const kind = docKind(saved);
              return (
                <Pressable
                  key={docId(saved)}
                  onPress={() => openDoc(kind, docId(saved))}
                  style={({ pressed }) => [styles.docRow, pressed && styles.dim]}>
                  <Ionicons name={docKinds[kind].icon as IconName} size={20} color={kindColors[kind]} />
                  <View style={styles.cardText}>
                    <Text style={styles.docTitle} numberOfLines={1}>
                      {docTitle(saved)}
                    </Text>
                    <Text style={styles.cardDescription}>
                      {docKinds[kind].label} · {new Date(docDate(saved)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.heading}>Tenders</Text>
      <Pressable onPress={() => router.push('/business/tenders')} style={({ pressed }) => [styles.card, pressed && styles.dim]}>
        <IconBadge icon="newspaper" color="#0EA5E9" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Find government tenders</Text>
          <Text style={styles.cardDescription}>Search tenders.go.ke and check the AGPO set-aside</Text>
          <Text style={[styles.status, openTenders > 0 && styles.statusActive]}>
            {openTenders > 0 ? `${openTenders} tender${openTenders === 1 ? '' : 's'} tracked` : 'None tracked yet'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </Pressable>

      <Pressable
        onPress={() => router.push({ pathname: '/chat', params: { q: 'I need help with my business' } })}
        style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
        <Ionicons name="chatbubbles" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>Something else? Ask the attendant</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
  heading: { fontSize: 16, fontWeight: '700', color: Colors.navy, marginTop: Spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  list: { gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardDescription: { fontSize: 13, color: Colors.textMuted },
  status: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  statusActive: { color: Colors.primary, fontWeight: '600' },
  statusDone: { color: Colors.success },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 4,
  },
  tileTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 4 },
  tileText: { fontSize: 12, color: Colors.textMuted },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  docTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  dim: { opacity: 0.7 },
});
