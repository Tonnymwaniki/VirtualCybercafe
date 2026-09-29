import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Note } from '@/components/gov/ui';
import { IconBadge } from '@/components/icon-badge';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { travelTasks } from '@/data/gov-tasks';
import type { Profile } from '@/data/profile-fields';
import { taskColors } from '@/data/task-colors';
import { tripStages } from '@/data/visa-form';
import { useAuth } from '@/lib/auth';
import { GUEST_ID, loadProfile } from '@/lib/profile-store';
import { loadRecords, newId, saveRecord } from '@/lib/record-store';
import { passportWarning, tripCountdown } from '@/lib/travel-sample';
import { purposeLabel, TRIP_KEY, tripPurposes, visaNeedLabel, type Trip, type TripPurpose } from '@/lib/travel-types';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

// The Travel workspace: trips with a visa check, documents, the visa form and
// letters; plus work-abroad safety and the Kenya eTA for visitors.
export default function TravelScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  const [profile, setProfile] = useState<Profile>({});
  const [trips, setTrips] = useState<Trip[]>([]);
  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState<TripPurpose>('visit');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [problem, setProblem] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadProfile(userId).then(setProfile);
      loadRecords<Trip>(userId, TRIP_KEY).then((records) =>
        setTrips(Object.values(records).sort((a, b) => (a.departDate || '9').localeCompare(b.departDate || '9'))),
      );
    }, [userId]),
  );

  const addTrip = async () => {
    const dates = [departDate.trim(), returnDate.trim()];
    if (dates.some((d) => d && !datePattern.test(d))) {
      setProblem('Write dates as YYYY-MM-DD, e.g. 2026-12-20.');
      return;
    }
    const trip: Trip = {
      id: newId(),
      destination: destination.trim().slice(0, 80),
      purpose,
      departDate: dates[0],
      returnDate: dates[1],
      check: null,
      ready: [],
      stage: -1,
      formAnswers: {},
      letters: {},
      createdAt: new Date().toISOString(),
    };
    await saveRecord(userId, TRIP_KEY, trip.id, trip);
    setDestination('');
    setDepartDate('');
    setReturnDate('');
    setProblem('');
    router.push(`/travel/trip/${trip.id}` as Href);
  };

  const passportAlert = profile.passportExpiry ? passportWarning(profile.passportExpiry, { departDate: '', returnDate: '' }) : null;

  return (
    <Screen>
      <SubHeader title="Travel & Visa" />
      <Text style={styles.intro}>
        Tell me where you’re going. I’ll check the visa rules for Kenyans on official sites, get your documents and letters ready, and
        fill in the visa form with you.
      </Text>

      <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
        <Ionicons name="person-circle" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>
          {profile.passportNumber ? `Passport ${profile.passportNumber} saved in My Details` : 'Add your passport details in My Details once'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </Pressable>
      {passportAlert && <Note tone="warn">{passportAlert}</Note>}

      <Card title="Plan a trip">
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="Country, e.g. United Kingdom"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />
        <View style={styles.chips}>
          {tripPurposes.map((p) => (
            <Pressable key={p} onPress={() => setPurpose(p)} style={[styles.chip, purpose === p && styles.chipActive]}>
              <Text style={[styles.chipText, purpose === p && styles.chipTextActive]}>{purposeLabel[p]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
            value={departDate}
            onChangeText={setDepartDate}
            placeholder="Leaving (YYYY-MM-DD)"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.flex]}
          />
          <TextInput
            value={returnDate}
            onChangeText={setReturnDate}
            placeholder="Back (YYYY-MM-DD)"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.flex]}
          />
        </View>
        {!!problem && <Note tone="warn">{problem}</Note>}
        <View style={styles.row}>
          <Button label="Start this trip" icon="airplane" onPress={addTrip} disabled={!destination.trim()} />
        </View>
      </Card>

      {trips.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.heading}>My trips</Text>
          {trips.map((trip) => (
            <Pressable
              key={trip.id}
              onPress={() => router.push(`/travel/trip/${trip.id}` as Href)}
              style={({ pressed }) => [styles.card, pressed && styles.dim]}>
              <IconBadge icon="airplane" color="#6366F1" />
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{trip.destination}</Text>
                <Text style={styles.cardDescription}>
                  {purposeLabel[trip.purpose]}
                  {trip.check ? ` · ${visaNeedLabel[trip.check.need]}` : ''}
                </Text>
                <Text style={[styles.status, styles.statusActive]}>
                  {tripCountdown(trip.departDate)}
                  {trip.stage >= 0 ? ` · ${tripStages[trip.stage]}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.heading}>More</Text>
      <View style={styles.list}>
        <Pressable onPress={() => router.push('/travel/abroad')} style={({ pressed }) => [styles.card, pressed && styles.dim]}>
          <IconBadge icon="shield-checkmark" color="#EF4444" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Working abroad? Check the agent</Text>
            <Text style={styles.cardDescription}>Check a recruitment agency and a job offer for scam signs</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
        {travelTasks.map((task) => (
          <Pressable
            key={task.id}
            onPress={() => router.push(`/gov/${task.id}` as Href)}
            style={({ pressed }) => [styles.card, pressed && styles.dim]}>
            <IconBadge icon={task.icon} color={taskColors[task.id]} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{task.title}</Text>
              <Text style={styles.cardDescription}>{task.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        ))}
        <Pressable onPress={() => router.push('/gov/passport' as Href)} style={({ pressed }) => [styles.card, pressed && styles.dim]}>
          <IconBadge icon="book" color="#2563EB" />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Get or renew a Kenyan passport</Text>
            <Text style={styles.cardDescription}>Guided on eCitizen, in Government Services</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
  heading: { fontSize: 16, fontWeight: '700', color: Colors.navy, marginTop: Spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: Colors.onDark },
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
  status: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  statusActive: { color: Colors.primary, fontWeight: '600' },
  dim: { opacity: 0.7 },
});
