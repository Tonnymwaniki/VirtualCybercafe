import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export function openUrl(url: string) {
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'good' | 'warn' }) {
  const icon = tone === 'good' ? 'checkmark-circle' : tone === 'warn' ? 'alert-circle' : 'information-circle';
  const color = tone === 'good' ? Colors.success : tone === 'warn' ? Colors.warning : Colors.primary;
  return (
    <View style={[styles.note, { borderColor: color }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

type CheckRowProps = {
  label: string;
  detail?: string;
  checked: boolean;
  onToggle?: () => void;
  children?: ReactNode;
};

export function CheckRow({ label, detail, checked, onToggle, children }: CheckRowProps) {
  return (
    <View style={styles.checkRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        disabled={!onToggle}
        hitSlop={6}
        style={styles.checkPress}>
        <Ionicons
          name={checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={checked ? Colors.success : Colors.textMuted}
        />
        <View style={styles.checkText}>
          <Text style={[styles.checkLabel, checked && styles.checkLabelDone]}>{label}</Text>
          {!!detail && <Text style={styles.checkDetail}>{detail}</Text>}
        </View>
      </Pressable>
      {children}
    </View>
  );
}

export function LinkButton({ label, onPress, icon = 'open-outline' }: { label: string; onPress: () => void; icon?: 'open-outline' | 'arrow-forward-circle' | 'cloud-upload' | 'chatbubbles' }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.linkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  note: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderLeftWidth: 3,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19, color: Colors.text },
  checkRow: { gap: Spacing.sm },
  checkPress: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  checkText: { flex: 1, gap: 2 },
  checkLabel: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  checkLabelDone: { color: Colors.textMuted },
  checkDetail: { fontSize: 12, color: Colors.textMuted },
  link: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  linkLabel: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  pressed: { opacity: 0.7 },
});
