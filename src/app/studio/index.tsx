import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLanguage, type TextKey } from '@/lib/i18n';

// Titles and descriptions are keys into the English/Kiswahili dictionaries.
type Tool = {
  title: TextKey;
  description: TextKey;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  href: Href;
};

const groups: { title: TextKey; tools: Tool[] }[] = [
  {
    title: 'wb.group.check',
    tools: [
      { title: 'wb.check.title', description: 'wb.check.desc', icon: 'shield-checkmark', color: '#16A34A', href: '/studio/check' },
    ],
  },
  {
    title: 'wb.group.limit',
    tools: [
      { title: 'wb.shrinkPdf.title', description: 'wb.shrinkPdf.desc', icon: 'contract', color: '#DC2626', href: '/studio/shrink-pdf' },
      { title: 'wb.compress.title', description: 'wb.compress.desc', icon: 'image', color: '#22C55E', href: '/studio/compress' },
      { title: 'wb.resize.title', description: 'wb.resize.desc', icon: 'resize', color: '#0EA5E9', href: '/studio/resize' },
      { title: 'wb.passport.title', description: 'wb.passport.desc', icon: 'person-circle', color: '#F59E0B', href: '/studio/passport' },
    ],
  },
  {
    title: 'wb.group.make',
    tools: [
      { title: 'wb.scan.title', description: 'wb.scan.desc', icon: 'scan', color: '#6366F1', href: '/studio/scan' },
      { title: 'wb.photosToPdf.title', description: 'wb.photosToPdf.desc', icon: 'documents', color: '#3B82F6', href: '/studio/photos-to-pdf' },
      { title: 'wb.merge.title', description: 'wb.merge.desc', icon: 'git-merge', color: '#8B5CF6', href: '/studio/merge' },
    ],
  },
  {
    title: 'wb.group.change',
    tools: [
      { title: 'wb.split.title', description: 'wb.split.desc', icon: 'cut', color: '#EC4899', href: '/studio/split' },
      { title: 'wb.pdfToJpg.title', description: 'wb.pdfToJpg.desc', icon: 'images', color: '#14B8A6', href: '/studio/pdf-to-jpg' },
    ],
  },
  {
    title: 'wb.group.print',
    tools: [
      { title: 'wb.printAnyCyber', description: 'wb.print.desc', icon: 'qr-code', color: '#0B1E5B', href: '/studio/print' },
    ],
  },
];

export default function WorkbenchScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  return (
    <Screen>
      <SubHeader title={t('wb.title')} />
      <Text style={styles.intro}>{t('wb.intro')}</Text>
      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{t(group.title)}</Text>
          {group.tools.map((tool) => (
            <Pressable key={tool.title} onPress={() => router.push(tool.href)} style={({ pressed }) => [styles.card, pressed && styles.dim]}>
              <IconBadge icon={tool.icon} color={tool.color} size={42} />
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{t(tool.title)}</Text>
                <Text style={styles.cardDescription}>{t(tool.description)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  group: { gap: Spacing.sm },
  groupTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardDescription: { fontSize: 13, color: Colors.textMuted },
  dim: { opacity: 0.6 },
});
