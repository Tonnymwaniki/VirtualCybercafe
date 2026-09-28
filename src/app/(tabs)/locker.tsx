import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { lockerFilters, lockerItems } from '@/data/locker';

type Filter = (typeof lockerFilters)[number];

export default function LockerScreen() {
  const [filter, setFilter] = useState<Filter>('All');
  const items =
    filter === 'All' ? lockerItems : lockerItems.filter((item) => item.category === filter);

  return (
    <Screen>
      <AppHeader title="My Digital Locker" />

      <View style={styles.secureNote}>
        <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
        <Text style={styles.secureText}>Your documents, ready whenever a service needs them.</Text>
      </View>

      <View style={styles.filters}>
        {lockerFilters.map((option) => {
          const active = option === filter;
          return (
            <Pressable
              key={option}
              onPress={() => setFilter(option)}
              style={[styles.filter, active && styles.filterActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={item.id} style={[styles.row, index === items.length - 1 && styles.lastRow]}>
            <IconBadge icon={item.icon} color={item.color} size={40} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowDetail}>{item.detail}</Text>
            </View>
            <Text style={styles.rowDate}>{item.date}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#EAF7EF',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  secureText: { flex: 1, fontSize: 13, color: Colors.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  filter: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, color: Colors.text },
  filterTextActive: { color: Colors.onDark, fontWeight: '600' },
  list: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowDetail: { fontSize: 12, color: Colors.textMuted },
  rowDate: { fontSize: 12, color: Colors.textMuted },
});
