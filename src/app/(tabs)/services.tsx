import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { catalogue, type Workspace } from '@/data/catalogue';
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

  const groups = [...services, accountService].map((service) => {
    const workspace = service.id === 'account' ? 'account' : workspaceOf[service.id];
    const entries = workspace
      ? catalogue.filter((e) => e.workspace === workspace && !e.hidden && e.route !== service.route)
      : [];
    return { service, entries };
  });

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
});
