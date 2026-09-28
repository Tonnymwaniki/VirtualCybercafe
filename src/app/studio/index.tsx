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
  href?: Href;
};

const tools: Tool[] = [
  {
    title: 'Passport Photo',
    description: 'Crop, resize to 600×600 and shrink under 200 KB for eCitizen',
    icon: 'person-circle',
    color: '#F59E0B',
    href: '/studio/passport',
  },
  {
    title: 'Photos to PDF',
    description: 'Turn photos of documents into one PDF, one page each',
    icon: 'documents',
    color: '#3B82F6',
    href: '/studio/photos-to-pdf',
  },
  {
    title: 'Shrink a Photo',
    description: 'Make a photo small enough to upload, e.g. under 500 KB',
    icon: 'contract',
    color: '#22C55E',
    href: '/studio/compress',
  },
  {
    title: 'Shrink a PDF',
    description: 'Coming soon',
    icon: 'document',
    color: '#94A3B8',
  },
];

export default function StudioScreen() {
  const router = useRouter();
  return (
    <Screen>
      <SubHeader title="Document Studio" />
      <Text style={styles.intro}>Get your documents ready for any online form.</Text>
      <View style={styles.list}>
        {tools.map((tool) => (
          <Pressable
            key={tool.title}
            disabled={!tool.href}
            onPress={() => tool.href && router.push(tool.href)}
            style={({ pressed }) => [styles.card, (pressed || !tool.href) && styles.dim]}>
            <IconBadge icon={tool.icon} color={tool.color} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{tool.title}</Text>
              <Text style={styles.cardDescription}>{tool.description}</Text>
            </View>
            {tool.href && <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted },
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
  dim: { opacity: 0.6 },
});
