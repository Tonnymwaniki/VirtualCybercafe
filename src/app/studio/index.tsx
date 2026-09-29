import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';

type Tool = {
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  href: Href;
};

const groups: { title: string; tools: Tool[] }[] = [
  {
    title: 'Check a file',
    tools: [
      { title: 'Check upload rules', description: 'See if a file meets a form’s rule, and fix it', icon: 'shield-checkmark', color: '#16A34A', href: '/studio/check' },
    ],
  },
  {
    title: 'Fit an upload limit',
    tools: [
      { title: 'Shrink a PDF', description: 'Make a PDF smaller, e.g. under 1 MB', icon: 'contract', color: '#DC2626', href: '/studio/shrink-pdf' },
      { title: 'Shrink a photo', description: 'Make a photo smaller, e.g. under 200 KB', icon: 'image', color: '#22C55E', href: '/studio/compress' },
      { title: 'Resize a photo', description: 'Exact pixels, e.g. 600 × 600', icon: 'resize', color: '#0EA5E9', href: '/studio/resize' },
      { title: 'Passport photo', description: 'Crop, 600 × 600 and under 200 KB', icon: 'person-circle', color: '#F59E0B', href: '/studio/passport' },
    ],
  },
  {
    title: 'Make a PDF',
    tools: [
      { title: 'Scan a document', description: 'Photo of a page, cleaned up like a scanner', icon: 'scan', color: '#6366F1', href: '/studio/scan' },
      { title: 'Photos to PDF', description: 'Several photos, one PDF', icon: 'documents', color: '#3B82F6', href: '/studio/photos-to-pdf' },
      { title: 'Join PDFs', description: 'Combine PDFs and photos into one file', icon: 'git-merge', color: '#8B5CF6', href: '/studio/merge' },
    ],
  },
  {
    title: 'Change a PDF',
    tools: [
      { title: 'Pick or split pages', description: 'Keep, remove or separate pages', icon: 'cut', color: '#EC4899', href: '/studio/split' },
      { title: 'PDF to JPG', description: 'Pages as pictures, for JPG-only forms', icon: 'images', color: '#14B8A6', href: '/studio/pdf-to-jpg' },
    ],
  },
  {
    title: 'Print it',
    tools: [
      { title: 'Print at any cyber', description: 'A QR code and short code any cyber can print from', icon: 'qr-code', color: '#0B1E5B', href: '/studio/print' },
    ],
  },
];

export default function WorkbenchScreen() {
  const router = useRouter();
  return (
    <Screen>
      <SubHeader title="Document Workbench" />
      <Text style={styles.intro}>Get any document ready for an online form. Everything happens on your phone; nothing is uploaded unless you save it to your Locker.</Text>
      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          {group.tools.map((tool) => (
            <Pressable key={tool.title} onPress={() => router.push(tool.href)} style={({ pressed }) => [styles.card, pressed && styles.dim]}>
              <IconBadge icon={tool.icon} color={tool.color} size={42} />
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{tool.title}</Text>
                <Text style={styles.cardDescription}>{tool.description}</Text>
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
