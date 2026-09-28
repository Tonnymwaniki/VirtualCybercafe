import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { ChatAction } from '@/lib/chat-types';
import { documentHtml } from '@/lib/document-html';
import { sharePdfFromHtml } from '@/lib/images';

type IconName = ComponentProps<typeof Ionicons>['name'];

function iconFor(action: ChatAction): IconName {
  if (action.type === 'document') return 'document-text';
  if (action.type === 'link') return 'open-outline';
  return 'arrow-forward-circle';
}

function labelFor(action: ChatAction) {
  if (action.type === 'document') return `Download "${action.title}" (PDF)`;
  return action.label;
}

// Buttons under an attendant message: open an app tool, download a drafted
// document, or open an official website.
export function ChatActions({ actions }: { actions: ChatAction[] }) {
  const router = useRouter();

  const run = (action: ChatAction) => {
    if (action.type === 'open') router.push(action.route as Href);
    else if (action.type === 'document') sharePdfFromHtml(documentHtml(action.title, action.body));
    else if (Platform.OS === 'web') window.open(action.url, '_blank');
    else Linking.openURL(action.url);
  };

  return (
    <View style={styles.list}>
      {actions.map((action, index) => (
        <Pressable
          key={index}
          onPress={() => run(action)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Ionicons name={iconFor(action)} size={18} color={Colors.primary} />
          <Text style={styles.label} numberOfLines={2}>
            {labelFor(action)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: 'flex-start', maxWidth: '85%', gap: Spacing.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  label: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  pressed: { opacity: 0.7 },
});
