import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/lib/i18n';

const SEEN_KEY = 'vc-welcome-seen';

const points = [
  { icon: 'chatbubbles', text: 'welcome.point1' },
  { icon: 'person-circle', text: 'welcome.point2' },
  { icon: 'help-circle', text: 'welcome.point3' },
] as const;

const starters = [
  { label: 'welcome.kra', route: '/gov/kra_pin' },
  { label: 'welcome.job', route: '/jobs' },
  { label: 'welcome.travel', route: '/travel' },
  { label: 'welcome.print', route: '/print' },
] as const;

// Shown on Home until the person taps "Got it" or picks a starter.
export function WelcomeCard() {
  const router = useRouter();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => setVisible(!seen))
      .catch(() => setVisible(false));
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  };

  if (!visible) return null;
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Mascot size={48} />
        <Text style={styles.title}>{t('welcome.title')}</Text>
      </View>
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
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.navy, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.onDark },
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
