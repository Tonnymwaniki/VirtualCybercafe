import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { isLiveService } from '@/data/launch';
import { services } from '@/data/services';
import { serviceText, useLanguage } from '@/lib/i18n';

// Layout for a service's folder of screens: the screens when the service is
// live, otherwise a "Coming soon" page, so links from old chats, reminders
// or the attendant never open an unfinished service.
export function ServiceGate({ serviceId }: { serviceId: string }) {
  if (isLiveService(serviceId)) return <Stack screenOptions={{ headerShown: false }} />;
  return <ComingSoon serviceId={serviceId} />;
}

export function ComingSoon({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const service = services.find((s) => s.id === serviceId);
  const text = serviceText(t, serviceId);
  return (
    <Screen>
      <SubHeader title={text.title} help={false} />
      <View style={styles.card}>
        {service && <IconBadge icon={service.icon} color={service.color} size={64} />}
        <Text style={styles.title}>{t('soon.title', { name: text.title })}</Text>
        <Text style={styles.text}>{t('soon.text')}</Text>
        <View style={styles.buttons}>
          <Button label={t('soon.ask')} icon="chatbubbles" onPress={() => router.replace('/chat')} />
          <Button label={t('soon.home')} icon="home" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  text: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  buttons: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.sm },
});
