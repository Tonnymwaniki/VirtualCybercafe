import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { examplePrompts, services } from '@/data/services';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const trustPoints = [
  { icon: 'lock-closed', title: 'Secure & private', text: 'Your data is always protected' },
  { icon: 'flash', title: 'Fast & reliable', text: 'Get things done, quickly' },
  { icon: 'location', title: 'Local support', text: 'Available in Kiswahili and English' },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const user = session?.user;
  // Phone sign-ups have no name yet; fall back to a plain greeting.
  const firstName: string | undefined = user?.user_metadata?.first_name;
  const phone = user?.phone ? formatPhone(`+${user.phone.replace(/^\+/, '')}`) : null;
  const [request, setRequest] = useState('');
  const [sentRequest, setSentRequest] = useState<string | null>(null);

  // The AI attendant is not connected yet; for now we only echo the request back.
  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSentRequest(trimmed);
    setRequest('');
  };

  return (
    <Screen>
      <AppHeader title="Virtual Cybercafe" />

      <View>
        <Text style={styles.greeting}>
          {greeting()}{firstName ? `, ${firstName}` : ''}👋
        </Text>
        <Text style={styles.subtitle}>What do you need done today?</Text>
        {phone && (
          <View style={styles.accountRow}>
            <Text style={styles.accountText}>Signed in as {phone}</Text>
            <Pressable onPress={() => supabase.auth.signOut()} hitSlop={8}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.attendantCard}>
        <View style={styles.inputRow}>
          <TextInput
            value={request}
            onChangeText={setRequest}
            onSubmitEditing={() => send(request)}
            placeholder="Tell me what you need done..."
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            returnKeyType="send"
          />
          <Pressable accessibilityLabel="Tap to speak" hitSlop={8} style={styles.micButton}>
            <Ionicons name="mic" size={20} color={Colors.primary} />
          </Pressable>
          <Pressable
            accessibilityLabel="Send"
            onPress={() => send(request)}
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
            <Ionicons name="send" size={18} color={Colors.onDark} />
          </Pressable>
        </View>

        <Text style={styles.examplesLabel}>Examples</Text>
        <View style={styles.chips}>
          {examplePrompts.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => send(prompt)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Text style={styles.chipText}>{prompt}</Text>
            </Pressable>
          ))}
        </View>

        {sentRequest && (
          <View style={styles.notice}>
            <Ionicons name="chatbubble-ellipses" size={16} color={Colors.primary} />
            <Text style={styles.noticeText}>
              “{sentRequest}” received. The AI attendant is coming in the next update.
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Quick Services</Text>
      <View style={styles.grid}>
        {services.map((service) => (
          <Pressable
            key={service.id}
            onPress={() => router.navigate('/services')}
            style={({ pressed }) => [styles.gridItem, pressed && styles.pressed]}>
            <IconBadge icon={service.icon} color={service.color} size={44} />
            <Text style={styles.gridLabel} numberOfLines={1}>
              {service.shortTitle}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => router.navigate('/services')}
        style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}>
        <Text style={styles.moreText}>More services</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
      </Pressable>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>From digital to physical. We’ve got you.</Text>
        <Text style={styles.bannerText}>
          Complete online tasks, get documents printed, and more, all in one place.
        </Text>
        <View style={styles.trustList}>
          {trustPoints.map((point) => (
            <View key={point.title} style={styles.trustRow}>
              <Ionicons name={point.icon} size={20} color={Colors.onDark} />
              <View style={styles.trustTextBlock}>
                <Text style={styles.trustTitle}>{point.title}</Text>
                <Text style={styles.trustText}>{point.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 24, fontWeight: '700', color: Colors.text },
  subtitle: { marginTop: Spacing.xs, fontSize: 15, color: Colors.textMuted },
  accountRow: { marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  accountText: { fontSize: 13, color: Colors.textMuted },
  signOut: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  attendantCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: { flex: 1, fontSize: 15, color: Colors.text, paddingVertical: Spacing.sm },
  micButton: { padding: Spacing.xs },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examplesLabel: { fontSize: 13, color: Colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.card,
  },
  chipText: { fontSize: 13, color: Colors.text },
  notice: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  noticeText: { flex: 1, fontSize: 13, color: Colors.text },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.lg },
  gridItem: { width: '25%', alignItems: 'center', gap: Spacing.sm },
  gridLabel: { fontSize: 12, color: Colors.text },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  moreText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  banner: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  bannerTitle: { fontSize: 22, fontWeight: '700', color: Colors.onDark },
  bannerText: { fontSize: 14, color: Colors.onDarkMuted, lineHeight: 20 },
  trustList: { marginTop: Spacing.md, gap: Spacing.md },
  trustRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  trustTextBlock: { flex: 1 },
  trustTitle: { fontSize: 14, fontWeight: '600', color: Colors.onDark },
  trustText: { fontSize: 13, color: Colors.onDarkMuted },
  pressed: { opacity: 0.7 },
});
