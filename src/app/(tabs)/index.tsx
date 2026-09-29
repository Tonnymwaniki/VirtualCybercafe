import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { HomeHero } from '@/components/home-hero';
import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { FULL_APP, isLiveService } from '@/data/launch';
import { services } from '@/data/services';
import { useAuth } from '@/lib/auth';
import { loadContinueItems, shortDate, type ContinueItem } from '@/lib/continue';
import { serviceText, useLanguage } from '@/lib/i18n';
import { GUEST_ID } from '@/lib/profile-store';

function greetingKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'greeting.morning' as const;
  if (hour < 17) return 'greeting.afternoon' as const;
  return 'greeting.evening' as const;
}

const trustPoints = [
  { icon: 'lock-closed', title: 'trust.secure', text: 'trust.secureText' },
  { icon: 'flash', title: 'trust.fast', text: 'trust.fastText' },
  { icon: 'location', title: 'trust.local', text: 'trust.localText' },
] as const;

const examplePrompts = FULL_APP
  ? (['example.passport', 'example.cv', 'example.print', 'example.job'] as const)
  : (['example.cv', 'example.job', 'example.passportPhoto', 'example.shrink'] as const);

// Live services first; the rest show "Coming soon".
const orderedServices = [...services].sort((a, b) => Number(isLiveService(b.id)) - Number(isLiveService(a.id)));

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0];
  const { t } = useLanguage();
  const userId = user?.id ?? GUEST_ID;
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadContinueItems(userId).then(setContinueItems).catch(() => setContinueItems([]));
    }, [userId]),
  );
  // Opens the attendant chat with the request already sent.
  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    router.push({ pathname: '/chat', params: { q: trimmed } });
  };

  return (
    <Screen>
      <AppHeader title="Virtual Cybercafe" />

      <HomeHero greeting={`${t(greetingKey())}${firstName ? `, ${firstName}` : ''} 👋`} />

      {continueItems.length > 0 && (
        <View style={styles.continueBlock}>
          <Text style={styles.sectionTitle}>{t('continue.title')}</Text>
          {continueItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(item.route as Href)}
              style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}>
              <IconBadge icon={item.icon} color={item.color} />
              <View style={styles.continueText}>
                <Text style={styles.continueTitle} numberOfLines={1}>
                  {item.place ? t('continue.trip', { place: item.place }) : item.title}
                </Text>
                <Text style={styles.continueNext} numberOfLines={1}>
                  {item.due ? t('continue.due', { date: shortDate(item.due) }) : item.next ? t('continue.next', { step: item.next }) : t('continue.started')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.attendantCard}>
        {/* Tapping anywhere here opens the full chat screen. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.ask')}
          onPress={() => router.push('/chat')}
          style={({ pressed }) => [styles.inputRow, pressed && styles.pressed]}>
          <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
          <Text style={styles.fakeInput} numberOfLines={1}>
            {t('home.placeholder')}
          </Text>
          <View style={styles.askButton}>
            <Text style={styles.askText}>{t('home.ask')}</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.onDark} />
          </View>
        </Pressable>

        <Text style={styles.examplesLabel}>{t('home.examples')}</Text>
        <View style={styles.chips}>
          {examplePrompts.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => send(t(prompt))}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Text style={styles.chipText}>{t(prompt)}</Text>
            </Pressable>
          ))}
        </View>

      </View>

      <Text style={styles.sectionTitle}>{t('home.quickServices')}</Text>
      <View style={styles.grid}>
        {orderedServices.map((service) =>
          isLiveService(service.id) ? (
            <Pressable
              key={service.id}
              onPress={() =>
                service.route
                  ? router.push(service.route)
                  : router.push({ pathname: '/chat', params: { q: serviceText(t, service.id).title } })
              }
              style={({ pressed }) => [styles.gridItem, pressed && styles.pressed]}>
              <IconBadge icon={service.icon} color={service.color} size={44} />
              <Text style={styles.gridLabel} numberOfLines={1}>
                {serviceText(t, service.id).short}
              </Text>
            </Pressable>
          ) : (
            <View key={service.id} style={[styles.gridItem, styles.soonItem]} accessibilityLabel={`${serviceText(t, service.id).title}, ${t('soon.badge')}`}>
              <IconBadge icon={service.icon} color={Colors.textMuted} size={44} />
              <Text style={[styles.gridLabel, styles.soonLabel]} numberOfLines={1}>
                {serviceText(t, service.id).short}
              </Text>
              <Text style={styles.soonBadge} numberOfLines={1}>
                {t('soon.badge')}
              </Text>
            </View>
          ),
        )}
      </View>

      <Pressable
        onPress={() => router.navigate('/services')}
        style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}>
        <Text style={styles.moreText}>{t('home.moreServices')}</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
      </Pressable>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{t('home.bannerTitle')}</Text>
        <Text style={styles.bannerText}>{t('home.bannerText')}</Text>
        <View style={styles.trustList}>
          {trustPoints.map((point) => (
            <View key={point.title} style={styles.trustRow}>
              <Ionicons name={point.icon} size={20} color={Colors.onDark} />
              <View style={styles.trustTextBlock}>
                <Text style={styles.trustTitle}>{t(point.title)}</Text>
                <Text style={styles.trustText}>{t(point.text)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  attendantCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  fakeInput: { flex: 1, fontSize: 15, color: Colors.textMuted, paddingVertical: Spacing.sm },
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  askText: { fontSize: 15, fontWeight: '700', color: Colors.onDark },
  continueBlock: { gap: Spacing.sm },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: Spacing.md,
  },
  continueText: { flex: 1, gap: 2 },
  continueTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  continueNext: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  examplesLabel: { fontSize: 13, color: Colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.card,
  },
  chipText: { fontSize: 13, color: Colors.text },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.lg },
  gridItem: { width: '25%', alignItems: 'center', gap: Spacing.sm },
  gridLabel: { fontSize: 12, color: Colors.text },
  soonItem: { opacity: 0.75, gap: 4 },
  soonLabel: { color: Colors.textMuted },
  soonBadge: { fontSize: 10, fontWeight: '700', color: Colors.primary, marginTop: -2 },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  moreText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  banner: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  bannerTitle: { fontSize: 22, fontWeight: '700', color: Colors.onDark },
  bannerText: { fontSize: 14, color: Colors.onDarkMuted, lineHeight: 20 },
  trustList: { marginTop: Spacing.md, gap: Spacing.md },
  trustRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  trustTextBlock: { flex: 1 },
  trustTitle: { fontSize: 14, fontWeight: '600', color: Colors.onDark },
  trustText: { fontSize: 13, color: Colors.onDarkMuted },
  pressed: { opacity: 0.7 },
});
