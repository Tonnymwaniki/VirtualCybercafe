import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { needsOnboarding } from '@/lib/onboarding';
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

// Version one: the four things people come for, as big buttons.
const homeActions = [
  { title: 'home.actJob', text: 'home.actJobText', icon: 'briefcase', color: '#EF4444', ask: 'home.actJobAsk' },
  { title: 'home.actFile', text: 'home.actFileText', icon: 'document-text', color: '#3B82F6', route: '/studio' },
  { title: 'home.actPhoto', text: 'home.actPhotoText', icon: 'person-circle', color: '#F59E0B', route: '/studio/passport' },
  { title: 'home.actPrint', text: 'home.actPrintText', icon: 'qr-code', color: '#0B1E5B', route: '/studio/print' },
] as const;

const soonServices = services.filter((service) => !isLiveService(service.id));

// Live services first; the rest show "Coming soon".
const orderedServices = [...services].sort((a, b) => Number(isLiveService(b.id)) - Number(isLiveService(a.id)));

export default function HomeScreen() {
  const router = useRouter();

  // First open: the three welcome screens.
  useEffect(() => {
    needsOnboarding().then((needed) => needed && router.push('/welcome'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

      {/* Form Intelligence: its own tab, and this big button. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.navigate('/forms')}
        style={({ pressed }) => [styles.formsButton, pressed && styles.pressed]}>
        <View style={styles.formsIcon}>
          <Ionicons name="sparkles" size={22} color="#FCD34D" />
        </View>
        <View style={styles.formsText}>
          <Text style={styles.formsTitle}>{t('forms.homeTitle')}</Text>
          <Text style={styles.formsSub}>{t('forms.homeText')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.onDark} />
      </Pressable>

      {FULL_APP ? (
        <>
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

        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>{t('home.whatNeed')}</Text>
          <View style={styles.actions}>
            {homeActions.map((action) => (
              <Pressable
                key={action.title}
                onPress={() => ('ask' in action ? send(t(action.ask)) : router.push(action.route as Href))}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                <IconBadge icon={action.icon} color={action.color} size={44} />
                <Text style={styles.actionTitle}>{t(action.title)}</Text>
                <Text style={styles.actionText}>{t(action.text)}</Text>
              </Pressable>
            ))}
          </View>
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


          <Pressable
            onPress={() => router.navigate('/services')}
            style={({ pressed }) => [styles.soonRow, pressed && styles.pressed]}>
            <View style={styles.soonIcons}>
              {soonServices.map((service) => (
                <Ionicons key={service.id} name={service.icon} size={16} color={Colors.textMuted} />
              ))}
            </View>
            <Text style={styles.soonRowText} numberOfLines={2}>
              {t('home.soonRow', { list: soonServices.map((service) => serviceText(t, service.id).short).join(', ') })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
        </>
      )}

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
  formsButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.lg },
  formsIcon: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.navyLight, alignItems: 'center', justifyContent: 'center' },
  formsText: { flex: 1, gap: 2 },
  formsTitle: { fontSize: 16, fontWeight: '800', color: Colors.onDark },
  formsSub: { fontSize: 13, lineHeight: 18, color: Colors.onDarkMuted },
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  action: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  actionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  actionText: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  soonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  soonIcons: { flexDirection: 'row', gap: 4 },
  soonRowText: { flex: 1, fontSize: 12, color: Colors.textMuted },
  pressed: { opacity: 0.7 },
});
