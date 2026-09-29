import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { checkConnection, isOnline, onConnectionChange } from '@/lib/connection';
import { useLanguage } from '@/lib/i18n';

// A slim bar at the top of every screen while the app can't reach the
// internet, saying what still works, with a button to check again.
export function OfflineNotice() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [online, setOnline] = useState(isOnline);
  const [checking, setChecking] = useState(false);

  const [hidden, setHidden] = useState(false);

  useEffect(
    () =>
      onConnectionChange((next) => {
        setOnline(next);
        setHidden(false);
      }),
    [],
  );

  if (online || hidden) return null;
  const retry = async () => {
    setChecking(true);
    await checkConnection();
    setChecking(false);
  };
  return (
    <View style={[styles.wrap, { top: insets.top + Spacing.xs }]} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="alert">
        <Ionicons name="cloud-offline" size={20} color={Colors.onDark} />
        <View style={styles.text}>
          <Text style={styles.title}>{t('offline.title')}</Text>
          <Text style={styles.body}>{t('offline.text')}</Text>
        </View>
        <Pressable onPress={retry} disabled={checking} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.dim]}>
          {checking ? <ActivityIndicator size="small" color={Colors.navy} /> : <Text style={styles.buttonText}>{t('offline.retry')}</Text>}
        </Pressable>
        <Pressable onPress={() => setHidden(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('offline.hide')}>
          <Ionicons name="close" size={18} color="#CBD5E1" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.md, right: Spacing.md, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.navy, borderRadius: Radius.md, padding: Spacing.sm },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.onDark },
  body: { fontSize: 12, color: '#CBD5E1', lineHeight: 16 },
  button: { backgroundColor: Colors.onDark, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6, minWidth: 72, alignItems: 'center' },
  buttonText: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  dim: { opacity: 0.6 },
});
