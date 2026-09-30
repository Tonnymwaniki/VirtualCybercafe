import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LanguageToggle } from '@/components/language-toggle';
import { Mascot } from '@/components/mascot';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useLanguage, type TextKey } from '@/lib/i18n';
import { finishOnboarding } from '@/lib/onboarding';

const points: { icon: ComponentProps<typeof Ionicons>['name']; text: TextKey }[] = [
  { icon: 'briefcase', text: 'onboard.point1' },
  { icon: 'document-text', text: 'onboard.point2' },
  { icon: 'print', text: 'onboard.point3' },
];

// First open: what the app does, sign in, and the quickest way to fill My
// Details. Three short screens, each skippable.
export default function WelcomeScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  // Coming back from sign-in moves on to the details step.
  useEffect(() => {
    if (user && step === 1) setStep(2);
  }, [user, step]);

  const leave = async (to?: Href) => {
    await finishOnboarding();
    if (!to && router.canGoBack()) router.back();
    else router.replace(to ?? '/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.top}>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.topRight}>
            <LanguageToggle />
            <Pressable onPress={() => leave()} hitSlop={8}>
              <Text style={styles.skip}>{t('onboard.skip')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {step === 0 && (
            <>
              <View style={styles.hero}>
                <Mascot size={150} full />
              </View>
              <Text style={styles.title}>{t('onboard.title1')}</Text>
              <Text style={styles.text}>{t('onboard.text1')}</Text>
              <View style={styles.points}>
                {points.map((point) => (
                  <View key={point.text} style={styles.point}>
                    <View style={styles.pointIcon}>
                      <Ionicons name={point.icon} size={18} color={Colors.primary} />
                    </View>
                    <Text style={styles.pointText}>{t(point.text)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <View style={styles.bigIcon}>
                <Ionicons name="shield-checkmark" size={56} color={Colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboard.title2')}</Text>
              <Text style={styles.text}>{t('onboard.text2')}</Text>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.bigIcon}>
                <Ionicons name="person-circle" size={56} color={Colors.primary} />
              </View>
              <Text style={styles.title}>{t('onboard.title3')}</Text>
              <Text style={styles.text}>{t('onboard.text3')}</Text>
            </>
          )}
        </View>

        <View style={styles.actions}>
          {step === 0 && <Button label={t('onboard.next')} icon="arrow-forward" onPress={() => setStep(user ? 2 : 1)} />}
          {step === 1 && (
            <>
              <Button label={t('onboard.signIn')} icon="call" onPress={() => router.push('/sign-in')} disabled={loading} />
              <Button label={t('onboard.later')} variant="secondary" onPress={() => setStep(2)} />
            </>
          )}
          {step === 2 && (
            <>
              {user && <Text style={styles.signedIn}>{t('onboard.signedIn')}</Text>}
              <Button label={t('onboard.cv')} icon="document-attach" onPress={() => leave('/profile')} />
              <Button label={t('onboard.id')} icon="card" variant="secondary" onPress={() => leave('/profile')} />
              <Pressable onPress={() => leave()} style={styles.textButton}>
                <Text style={styles.skip}>{t('onboard.done')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  page: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },
  skip: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  body: { flex: 1, justifyContent: 'center', gap: Spacing.lg },
  hero: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.navy,
    borderRadius: 120,
    width: 220,
    height: 220,
  },
  bigIcon: {
    alignSelf: 'center',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  text: { fontSize: 16, lineHeight: 23, color: Colors.textMuted, textAlign: 'center' },
  points: { gap: Spacing.md, marginTop: Spacing.sm },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  pointIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, fontSize: 15, color: Colors.text },
  actions: { gap: Spacing.md },
  buttonRow: { flexDirection: 'row' },
  signedIn: { textAlign: 'center', color: Colors.success, fontWeight: '600' },
  textButton: { alignItems: 'center', paddingVertical: Spacing.sm },
});
