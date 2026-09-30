import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Suggestion } from '@/lib/chat-suggest';
import { shortDate, type ContinueItem } from '@/lib/continue';
import { useLanguage } from '@/lib/i18n';

type IconName = ComponentProps<typeof Ionicons>['name'];

function greetingKey(hour = new Date().getHours()) {
  if (hour < 12) return 'greeting.morning' as const;
  if (hour < 17) return 'greeting.afternoon' as const;
  return 'greeting.evening' as const;
}

// An empty chat: the robot greets the person by name, shows their
// unfinished work and a few starters picked from their details. Made on
// the phone, with no AI call.
export function ChatWelcome({
  firstName,
  continueItems,
  suggestions,
  onSuggestion,
}: {
  firstName?: string;
  continueItems: ContinueItem[];
  suggestions: Suggestion[];
  onSuggestion: (text: string) => void;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const greeting = t(greetingKey());

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.glow} />
        {/* Wrapped so it draws above the glow on the web. */}
        <View>
          <Mascot size={110} full />
        </View>
        <Text style={styles.hi}>{firstName ? t('chat.hi', { greeting, name: firstName }) : t('chat.hiNoName', { greeting })}</Text>
        <Text style={styles.intro}>{t('chat.welcome')}</Text>
      </View>

      {continueItems.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{t('chat.pickUp')}</Text>
          {continueItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(item.route as Href)}
              style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}>
              <View style={[styles.continueIcon, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon} size={18} color="#FFFFFF" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.continueTitle} numberOfLines={1}>
                  {item.place ? t('continue.trip', { place: item.place }) : item.title}
                </Text>
                <Text style={styles.continueNext} numberOfLines={1}>
                  {item.due ? t('continue.due', { date: shortDate(item.due) }) : item.next ? t('continue.next', { step: item.next }) : t('continue.started')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.block}>
        <Text style={styles.blockTitle}>{t('chat.try')}</Text>
        <View style={styles.chips}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.label}
              onPress={() => (suggestion.route ? router.push(suggestion.route as Href) : onSuggestion(t(suggestion.label)))}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Ionicons name={suggestion.icon as IconName} size={16} color={Colors.primary} />
              <Text style={styles.chipText}>{t(suggestion.label)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg, paddingTop: Spacing.sm },
  flex: { flex: 1 },
  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  glow: { position: 'absolute', top: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: Colors.navyLight },
  hi: { fontSize: 22, fontWeight: '800', color: Colors.onDark, textAlign: 'center' },
  intro: { fontSize: 14, lineHeight: 20, color: Colors.onDarkMuted, textAlign: 'center', maxWidth: 420 },
  block: { gap: Spacing.sm },
  blockTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  continueIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  continueTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  continueNext: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  pressed: { opacity: 0.7 },
});
