import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { onSignInNeeded } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';

// Shown at the bottom of any screen when the hosted app asked for sign-in
// before using the AI, with a button straight to sign-in.
export function SignInNotice() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => onSignInNeeded(() => setOpen(true)), []);
  useEffect(() => {
    if (user) setOpen(false);
  }, [user]);

  if (!open || pathname === '/sign-in') return null;
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + Spacing.lg }]} pointerEvents="box-none">
      <View style={styles.card}>
        <Ionicons name="lock-closed" size={22} color={Colors.primary} />
        <View style={styles.text}>
          <Text style={styles.title}>{t('signIn.aiTitle')}</Text>
          <Text style={styles.body}>{t('signIn.aiText')}</Text>
        </View>
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setOpen(false);
              router.push('/sign-in');
            }}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>{t('signIn.aiButton')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.later}>
            <Text style={styles.laterText}>{t('signIn.later')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  body: { fontSize: 13, color: Colors.textMuted },
  buttons: { alignItems: 'center', gap: 4 },
  primary: { backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: 8 },
  primaryText: { color: Colors.onDark, fontWeight: '700', fontSize: 14 },
  later: { paddingVertical: 4 },
  laterText: { color: Colors.textMuted, fontSize: 13 },
  pressed: { opacity: 0.7 },
});
