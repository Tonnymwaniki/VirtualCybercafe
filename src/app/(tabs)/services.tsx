import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { liveCatalogue, type Workspace } from '@/data/catalogue';
import { isLiveService } from '@/data/launch';
import { services, type Service } from '@/data/services';
import { serviceText, useLanguage } from '@/lib/i18n';

const workspaceOf: Record<string, Workspace> = {
  government: 'government',
  jobs: 'jobs',
  education: 'education',
  documents: 'documents',
  print: 'print',
  business: 'business',
  travel: 'travel',
};

const accountService: Service = {
  id: 'account',
  title: 'Your account',
  shortTitle: 'Account',
  description: '',
  icon: 'person-circle',
  color: '#0EA5E9',
  route: '/locker',
};

// Every service, grouped by area, with the tasks and tools inside each one
// as chips that open them directly.
export default function ServicesScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const all = [...services, accountService];
  const groups = all.filter((service) => isLiveService(service.id)).map((service) => {
    const workspace = service.id === 'account' ? 'account' : workspaceOf[service.id];
    const entries = workspace ? liveCatalogue.filter((e) => e.workspace === workspace && e.route !== service.route) : [];
    return { service, entries };
  });
  // Services still being finished: shown so people see where the app is going.
  const soon = all.filter((service) => !isLiveService(service.id));

  const open = (service: Service) =>
    service.route
      ? router.push(service.route)
      : router.push({ pathname: '/chat', params: { q: serviceText(t, service.id).title } });

  return (
    <Screen>
      <AppHeader title={t('services.title')} />
      <Text style={styles.intro}>{t('services.intro')}</Text>
      <View style={styles.list}>
        {groups.map(({ service, entries }) => {
          const text = serviceText(t, service.id);
          return (
            <View key={service.id} style={styles.card}>
              <Pressable onPress={() => open(service)} style={({ pressed }) => [styles.head, pressed && styles.pressed]}>
                <IconBadge icon={service.icon} color={service.color} />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{text.title}</Text>
                  <Text style={styles.cardDescription}>{text.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </Pressable>
              {entries.length > 0 && (
                <View style={styles.chips}>
                  {entries.map((entry) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => router.push(entry.route as Href)}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                      <Text style={styles.chipText}>{entry.title}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
      {soon.length > 0 && (
        <>
          <Text style={styles.soonTitle}>{t('services.soon')}</Text>
          <View style={styles.list}>
            {soon.map((service) => {
              const text = serviceText(t, service.id);
              return (
                <View key={service.id} style={[styles.card, styles.soonCard]}>
                  <View style={styles.head}>
                    <IconBadge icon={service.icon} color={Colors.textMuted} />
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>{text.title}</Text>
                      <Text style={styles.cardDescription}>{text.description}</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t('soon.badge')}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted },
  list: { gap: Spacing.md },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardDescription: { fontSize: 13, color: Colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, backgroundColor: Colors.primarySoft, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  pressed: { opacity: 0.7 },
  soonTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  soonCard: { backgroundColor: Colors.background, borderStyle: 'dashed' },
  badge: { borderRadius: Radius.pill, backgroundColor: Colors.primarySoft, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
});
