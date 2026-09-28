import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { services } from '@/data/services';

export default function ServicesScreen() {
  const router = useRouter();
  return (
    <Screen>
      <AppHeader title="Services" />
      <Text style={styles.intro}>Everything a cybercafe does, from your phone.</Text>
      <View style={styles.list}>
        {services.map((service) => (
          <Pressable
            key={service.id}
            onPress={() =>
              service.route
                ? router.push(service.route)
                : router.push({ pathname: '/chat', params: { q: `I need help with ${service.title}` } })
            }
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <IconBadge icon={service.icon} color={service.color} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <Text style={styles.cardDescription}>{service.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted },
  list: { gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cardDescription: { fontSize: 13, color: Colors.textMuted },
  pressed: { opacity: 0.7 },
});
