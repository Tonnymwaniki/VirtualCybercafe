import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { FULL_APP } from '@/data/launch';
import { useLanguage } from '@/lib/i18n';

const SEEN_KEY = 'vc-welcome-seen';

const points = [
  { icon: 'chatbubbles', text: 'welcome.point1' },
  { icon: 'person-circle', text: 'welcome.point2' },
  { icon: 'help-circle', text: 'welcome.point3' },
] as const;

const starters = FULL_APP
  ? ([
      { label: 'welcome.kra', route: '/gov/kra_pin' },
      { label: 'welcome.job', route: '/jobs' },
      { label: 'welcome.travel', route: '/travel' },
      { label: 'welcome.print', route: '/print' },
    ] as const)
  : ([
      { label: 'welcome.job', route: '/jobs' },
      { label: 'welcome.cv', route: '/cv' },
      { label: 'welcome.photo', route: '/studio/passport' },
      { label: 'welcome.details', route: '/profile' },
    ] as const);

// The top of Home: the greeting beside the attendant robot and its speech
// bubble. On the first visit it also shows how the app works and starter
// buttons, until the person taps "Got it" or picks one.
export function HomeHero({ greeting }: { greeting: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => setFirstVisit(!seen))
      .catch(() => setFirstVisit(false));
  }, []);

  const dismiss = () => {
    setFirstVisit(false);
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.glow} />
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{t('hero.bubble')}</Text>
          </View>
          <View style={styles.tagline}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.onDarkMuted} />
            <Text style={styles.taglineText}>{t('hero.tagline')}</Text>
          </View>
        </View>
        <Mascot size={128} full />
      </View>

      {firstVisit && (
        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>{t('welcome.title')}</Text>
          {points.map((point) => (
            <View key={point.text} style={styles.point}>
              <Ionicons name={point.icon} size={18} color={Colors.onDark} />
              <Text style={styles.pointText}>{t(point.text)}</Text>
            </View>
          ))}
          <Text style={styles.tryLabel}>{t('welcome.try')}</Text>
          <View style={styles.chips}>
            {starters.map((starter) => (
              <Pressable
                key={starter.label}
                onPress={() => {
                  dismiss();
                  router.push(starter.route as Href);
                }}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                <Text style={styles.chipText}>{t(starter.label)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={dismiss} style={({ pressed }) => [styles.done, pressed && styles.pressed]}>
            <Text style={styles.doneText}>{t('welcome.done')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.lg, overflow: 'hidden' },
  // A soft blue light behind the robot.
  glow: {
    position: 'absolute',
    right: -40,
    top: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.primary,
    opacity: 0.35,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  text: { flex: 1, gap: Spacing.sm },
  greeting: { fontSize: 20, fontWeight: '700', color: Colors.onDark },
  subtitle: { fontSize: 14, color: Colors.onDarkMuted },
  bubble: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  bubbleText: { fontSize: 13, fontWeight: '600', color: Colors.navy, lineHeight: 18 },
  tagline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taglineText: { fontSize: 12, fontWeight: '600', color: Colors.onDarkMuted },
  welcome: { gap: Spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: Spacing.lg },
  welcomeTitle: { fontSize: 17, fontWeight: '700', color: Colors.onDark },
  point: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  pointText: { flex: 1, fontSize: 14, color: Colors.onDarkMuted, lineHeight: 20 },
  tryLabel: { fontSize: 13, fontWeight: '600', color: Colors.onDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { backgroundColor: Colors.card, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.navy },
  done: { alignSelf: 'flex-end', paddingHorizontal: Spacing.md, paddingVertical: 6 },
  doneText: { fontSize: 14, fontWeight: '700', color: Colors.onDark },
  pressed: { opacity: 0.7 },
});
