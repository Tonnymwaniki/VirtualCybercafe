import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TenderCard } from '@/components/biz/tender-card';
import { Button } from '@/components/button';
import { Card, Note } from '@/components/gov/ui';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Profile } from '@/data/profile-fields';
import { searchTenders } from '@/lib/biz-client';
import { TENDER_KEY, tenderStatuses, type SavedTender, type Tender, type TenderSearch } from '@/lib/biz-types';
import { useAuth } from '@/lib/auth';
import { deadlineLabel } from '@/lib/jobs-store';
import { GUEST_ID, loadProfile } from '@/lib/profile-store';
import { loadRecords, newId, saveRecord } from '@/lib/record-store';

// Tenders: search official tender sites and track the ones worth bidding for.
export default function TendersScreen() {
  const router = useRouter();
  // The attendant can open this screen with the search filled in.
  const params = useLocalSearchParams<{ q?: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;

  const [profile, setProfile] = useState<Profile>({});
  const [query, setQuery] = useState('');
  const [county, setCounty] = useState('');
  const [result, setResult] = useState<TenderSearch | null>(null);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState<SavedTender[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadProfile(userId).then((p) => {
        setProfile(p);
        setQuery((q) => q || params.q?.slice(0, 120) || p.businessNature || '');
        setCounty((c) => c || p.county || '');
      });
      loadRecords<SavedTender>(userId, TENDER_KEY).then((records) =>
        setSaved(Object.values(records).sort((a, b) => (a.tender.closingDate || '9').localeCompare(b.tender.closingDate || '9'))),
      );
    }, [userId, params.q]),
  );

  const search = async () => {
    setSearching(true);
    setResult(await searchTenders(query.trim(), county.trim(), profile.agpoCategory ?? ''));
    setSearching(false);
  };

  const save = async (tender: Tender) => {
    const record: SavedTender = { id: newId(), tender, status: 0, ready: [], createdAt: new Date().toISOString() };
    await saveRecord(userId, TENDER_KEY, record.id, record);
    router.push(`/business/tender/${record.id}` as Href);
  };

  const isSaved = (tender: Tender) => saved.some((s) => s.tender.url === tender.url && s.tender.title === tender.title);
  const agpo = profile.agpoCategory ?? '';

  return (
    <Screen>
      <SubHeader title="Tenders" />
      <Text style={styles.intro}>
        I search tenders.go.ke and other official sites for open government tenders that fit your business, and check whether you
        qualify for the AGPO set-aside.
      </Text>

      <Card title="What does your business supply?">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. stationery, cleaning services, catering"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />
        <TextInput
          value={county}
          onChangeText={setCounty}
          placeholder="County (optional)"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />
        <Text style={styles.muted}>
          {agpo ? `Your AGPO group: ${agpo}` : 'No AGPO certificate saved in My Details. Tenders reserved for youth, women and PWD need one.'}
        </Text>
        <View style={styles.row}>
          <Button label="Find tenders" icon="search" onPress={search} busy={searching} disabled={!query.trim()} />
        </View>
      </Card>

      <Note tone="warn">
        Tender documents on government sites are free. Never pay anyone who promises to get you a tender or an LPO.
      </Note>

      {result && (
        <View style={styles.list}>
          <Text style={styles.heading}>Found ({result.tenders.length})</Text>
          {result.tenders.map((tender) => (
            <TenderCard key={`${tender.url}${tender.title}`} tender={tender} agpoCategory={agpo}>
              <View style={styles.row}>
                <Button
                  label={isSaved(tender) ? 'Saved' : 'Track this tender'}
                  icon="bookmark"
                  variant="secondary"
                  onPress={() => save(tender)}
                  disabled={isSaved(tender)}
                />
              </View>
            </TenderCard>
          ))}
          {!!result.note && <Note>{result.note}</Note>}
        </View>
      )}

      {saved.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.heading}>My tenders</Text>
          {saved.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/business/tender/${s.id}` as Href)}
              style={({ pressed }) => [styles.savedRow, pressed && styles.dim]}>
              <View style={styles.flex}>
                <Text style={styles.savedTitle} numberOfLines={2}>
                  {s.tender.title}
                </Text>
                <Text style={styles.muted}>
                  {tenderStatuses[s.status]} · {s.tender.closingDate ? deadlineLabel(s.tender.closingDate) : 'No closing date'} ·{' '}
                  {s.ready.length} of {s.tender.documents.length} documents ready
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
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
  row: { flexDirection: 'row', gap: Spacing.md },
  list: { gap: Spacing.md },
  heading: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  flex: { flex: 1, gap: 2 },
  savedTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  dim: { opacity: 0.7 },
});
