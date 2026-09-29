import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { WorkCard } from '@/components/chat/work-card';
import { ActionCard } from '@/components/chat/action-card';
import { DocActions } from '@/components/biz/doc-actions';
import { IconBadge } from '@/components/icon-badge';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { entryForPath, type Workspace } from '@/data/catalogue';
import { findGovTask, type GovTaskId } from '@/data/gov-tasks';
import { services } from '@/data/services';
import { taskColors } from '@/data/task-colors';
import type { ActionState, ChatAction } from '@/lib/chat-types';
import { documentHtml } from '@/lib/document-html';

type IconName = ComponentProps<typeof Ionicons>['name'];

const workspaceService: Record<Workspace, string> = {
  government: 'government',
  jobs: 'jobs',
  education: 'education',
  documents: 'documents',
  print: 'print',
  business: 'business',
  travel: 'travel',
  account: 'account',
};

// The icon, colour and one-line description for a screen the attendant opens.
function screenLook(route: string): { icon: IconName; color: string; description: string } {
  const entry = entryForPath(route);
  const task = findGovTask(entry?.id);
  if (task) return { icon: task.icon, color: taskColors[task.id as GovTaskId], description: task.description };
  const service = services.find((s) => s.id === (entry ? workspaceService[entry.workspace] : ''));
  return {
    icon: service?.icon ?? 'person-circle',
    color: service?.color ?? '#0EA5E9',
    description: entry?.description ?? '',
  };
}

function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const isOfficial = (url: string) => /\.go\.ke$|\.ac\.ke$|\.or\.ke$/.test(domainOf(url));

// Words that link a checklist item to a Locker file, e.g. "National ID" to
// national-id.jpg.
function inLocker(item: string, lockerNames: string[]) {
  const words = item.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const key = words.filter((w) => !['your', 'copy', 'the', 'and', 'with', 'from', 'original', 'scan', 'photo'].includes(w));
  if (!key.length) return false;
  return lockerNames.some((name) => {
    const file = name.toLowerCase().replace(/[^a-z]+/g, ' ');
    return key.filter((w) => file.includes(w)).length >= Math.min(2, key.length);
  });
}

function ServiceCard({ label, route }: { label: string; route: string }) {
  const router = useRouter();
  const look = screenLook(route);
  return (
    <Pressable onPress={() => router.push(route as Href)} style={({ pressed }) => [styles.card, styles.service, pressed && styles.pressed]}>
      <IconBadge icon={look.icon} color={look.color} />
      <View style={styles.flex}>
        <Text style={styles.title}>{label.replace(/^(Open|Fungua)\s+/, '')}</Text>
        {!!look.description && (
          <Text style={styles.muted} numberOfLines={2}>
            {look.description}
          </Text>
        )}
      </View>
      <View style={[styles.openPill, { backgroundColor: look.color }]}>
        <Text style={styles.openText}>{label.startsWith('Fungua') ? 'Fungua' : 'Open'}</Text>
      </View>
    </Pressable>
  );
}

function ChecklistCard({ title, items, lockerNames }: { title: string; items: string[]; lockerNames: string[] }) {
  const [ticked, setTicked] = useState<number[]>(() => items.map((item, i) => (inLocker(item, lockerNames) ? i : -1)).filter((i) => i >= 0));
  const auto = items.map((item) => inLocker(item, lockerNames));
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name="checkbox" size={18} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>
          {ticked.length}/{items.length}
        </Text>
      </View>
      {items.map((item, index) => {
        const done = ticked.includes(index);
        return (
          <Pressable
            key={index}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            onPress={() => setTicked((t) => (done ? t.filter((i) => i !== index) : [...t, index]))}
            style={styles.checkRow}>
            <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={done ? Colors.success : Colors.textMuted} />
            <View style={styles.flex}>
              <Text style={[styles.body, done && styles.doneText]}>{item}</Text>
              {auto[index] && <Text style={styles.lockerTag}>In your Locker</Text>}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepsCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name="footsteps" size={18} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {steps.map((step, index) => (
        <View key={index} style={styles.stepRow}>
          <View style={styles.stepRail}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            {index < steps.length - 1 && <View style={styles.stepLine} />}
          </View>
          <Text style={[styles.body, styles.flex, styles.stepText]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function FeeCard({ amount, note, source }: { amount: string; note: string; source: string }) {
  return (
    <View style={[styles.card, styles.fee]}>
      <View style={styles.cardHead}>
        <Ionicons name="cash" size={18} color={Colors.success} />
        <Text style={styles.feeLabel}>Fee</Text>
      </View>
      <Text style={styles.amount}>{amount}</Text>
      {!!note && <Text style={styles.body}>{note}</Text>}
      {!!source && <Text style={styles.muted}>Source: {source}. Fees change, so confirm on the official site before paying.</Text>}
    </View>
  );
}

function LinkCard({ label, url }: { label: string; url: string }) {
  const official = isOfficial(url);
  return (
    <Pressable onPress={() => openUrl(url)} style={({ pressed }) => [styles.card, styles.service, pressed && styles.pressed]}>
      <View style={styles.globe}>
        <Ionicons name="globe-outline" size={20} color={Colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title}>{label}</Text>
        <View style={styles.domainRow}>
          <Text style={styles.muted}>{domainOf(url)}</Text>
          {official && (
            <View style={styles.officialBadge}>
              <Ionicons name="shield-checkmark" size={11} color={Colors.success} />
              <Text style={styles.officialText}>Official</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="open-outline" size={18} color={Colors.primary} />
    </Pressable>
  );
}

function DocumentCard({ title, body }: { title: string; body: string }) {
  const preview = body.split('\n').filter((l) => l.trim()).slice(0, 5).join('\n');
  const fileName = `${title.replace(/[^\w\- ]+/g, '').trim() || 'Document'}.pdf`;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name="document-text" size={18} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.paper}>
        <Text style={styles.paperText} numberOfLines={6}>
          {preview}
        </Text>
        <View style={styles.paperFade} />
      </View>
      <DocActions html={documentHtml(title, body)} fileName={fileName} />
    </View>
  );
}

function WarningCard({ text }: { text: string }) {
  return (
    <View style={[styles.card, styles.warning]}>
      <Ionicons name="warning" size={20} color={'#DC2626'} />
      <Text style={[styles.body, styles.flex, styles.warningText]}>{text}</Text>
    </View>
  );
}

// The cards under an attendant reply, in a steady order: warnings first,
// then what to do, then where to go.
const order: ChatAction['type'][] = ['work', 'warning', 'confirm', 'checklist', 'steps', 'fee', 'document', 'open', 'link'];

export function ChatCards({
  actions,
  lockerNames,
  onActionChange,
}: {
  actions: ChatAction[];
  lockerNames: string[];
  onActionChange?: (id: string, state: ActionState | undefined) => void;
}) {
  const sorted = [...actions].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return (
    <View style={styles.list}>
      {sorted.map((action, index) => {
        switch (action.type) {
          case 'open':
            return <ServiceCard key={index} label={action.label} route={action.route} />;
          case 'link':
            return <LinkCard key={index} label={action.label} url={action.url} />;
          case 'document':
            return <DocumentCard key={index} title={action.title} body={action.body} />;
          case 'checklist':
            return <ChecklistCard key={index} title={action.title} items={action.items} lockerNames={lockerNames} />;
          case 'steps':
            return <StepsCard key={index} title={action.title} steps={action.steps} />;
          case 'fee':
            return <FeeCard key={index} amount={action.amount} note={action.note} source={action.source} />;
          case 'warning':
            return <WarningCard key={index} text={action.text} />;
          case 'work':
            return <WorkCard key={action.id} outcome={action.outcome} />;
          case 'confirm':
            return (
              <ActionCard
                key={action.id}
                action={action.action}
                state={action.state}
                lockerNames={lockerNames}
                onChange={(state) => onActionChange?.(action.id, state)}
              />
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm, width: '100%' },
  flex: { flex: 1 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  service: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  muted: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  body: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  count: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  openPill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  openText: { fontSize: 13, fontWeight: '700', color: Colors.onDark },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 2 },
  doneText: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  lockerTag: { fontSize: 11, fontWeight: '700', color: Colors.success, marginTop: 2 },
  stepRow: { flexDirection: 'row', gap: Spacing.sm },
  stepRail: { alignItems: 'center', width: 24 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 12, fontWeight: '700', color: Colors.onDark },
  stepLine: { flex: 1, width: 2, backgroundColor: Colors.primarySoft, marginVertical: 2 },
  stepText: { paddingBottom: Spacing.sm, paddingTop: 2 },
  fee: { borderLeftWidth: 4, borderLeftColor: Colors.success },
  feeLabel: { fontSize: 13, fontWeight: '700', color: Colors.success },
  amount: { fontSize: 24, fontWeight: '800', color: Colors.navy },
  globe: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  domainRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  officialBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  officialText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  paper: {
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    overflow: 'hidden',
    maxHeight: 130,
  },
  paperText: { fontSize: 12, lineHeight: 18, color: Colors.text, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
  paperFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, backgroundColor: '#FFFDF7', opacity: 0.8 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderLeftWidth: 4, borderLeftColor: '#DC2626' },
  warningText: { color: '#7F1D1D', fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
