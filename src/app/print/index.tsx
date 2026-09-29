import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, Note } from '@/components/gov/ui';
import { JobRow } from '@/components/print/job-row';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { fileBytes, listFiles, readBytes, type StoredFile } from '@/lib/locker-store';
import { countPdfPages } from '@/lib/pdf-pages';
import { listShops, myJobs, sendJob } from '@/lib/print-store';
import { formatKsh, priceFor, type PrintJob, type PrintShop } from '@/lib/print-types';
import { GUEST_ID, loadProfile } from '@/lib/profile-store';
import { supabase } from '@/lib/supabase';

type Picked = { name: string; mimeType: string; bytes: ArrayBuffer; localUri?: string };

// Print Hub: send a document to a partner shop and collect it with a code.
export default function PrintScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? GUEST_ID;
  // With Supabase, sending needs an account so the shop and the customer can
  // both see the job. Demo mode works without one.
  const needsSignIn = !!supabase && !user;

  const [shops, setShops] = useState<PrintShop[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [lockerFiles, setLockerFiles] = useState<StoredFile[] | null>(null);
  const [file, setFile] = useState<Picked | null>(null);
  const [pages, setPages] = useState('1');
  const [pagesKnown, setPagesKnown] = useState(true);
  const [copies, setCopies] = useState(1);
  const [colour, setColour] = useState(false);
  const [doubleSided, setDoubleSided] = useState(false);
  const [note, setNote] = useState('');
  const [shopId, setShopId] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState('');
  const [county, setCounty] = useState('');

  useFocusEffect(
    useCallback(() => {
      listShops().then(setShops).catch(() => setProblem('Couldn’t load print shops. Check your connection.'));
      if (!needsSignIn) myJobs(userId).then(setJobs).catch(() => {});
      loadProfile(userId).then((profile) => setCounty(profile.county ?? ''));
    }, [userId, needsSignIn]),
  );

  // Shops in the user's county come first.
  const sortedShops = [...shops].sort(
    (a, b) => Number(b.county.toLowerCase() === county.toLowerCase()) - Number(a.county.toLowerCase() === county.toLowerCase()),
  );
  const shop = shops.find((s) => s.id === shopId) ?? null;
  const pageCount = Math.max(1, Math.min(500, parseInt(pages, 10) || 1));
  const price = shop ? priceFor(shop, { pages: pageCount, copies, colour, doubleSided }) : 0;

  const choose = async (picked: Picked) => {
    setFile(picked);
    setProblem('');
    const counted = picked.mimeType === 'application/pdf' ? countPdfPages(picked.bytes) : 1;
    setPagesKnown(counted !== null);
    setPages(String(counted ?? 1));
  };

  const fromPhone = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setLoadingFile(true);
    try {
      await choose({ name: asset.name, mimeType: asset.mimeType ?? 'application/pdf', bytes: await readBytes(asset.uri), localUri: asset.uri });
    } catch {
      setProblem('Couldn’t open that file. Try another one.');
    } finally {
      setLoadingFile(false);
    }
  };

  const showLocker = async () => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    setLockerFiles(await listFiles(user.id).catch(() => []));
  };

  const fromLocker = async (item: StoredFile) => {
    setLoadingFile(true);
    try {
      await choose({ name: item.name, mimeType: item.mimeType, bytes: await fileBytes(item), localUri: item.localUri });
      setLockerFiles(null);
    } catch {
      setProblem('Couldn’t open that Locker file. Check your connection.');
    } finally {
      setLoadingFile(false);
    }
  };

  const send = async () => {
    if (!file || !shop) return;
    setSending(true);
    setProblem('');
    try {
      const profile = await loadProfile(userId);
      const job = await sendJob({
        userId,
        shop,
        file,
        pages: pageCount,
        copies,
        colour,
        doubleSided,
        price,
        note: note.trim().slice(0, 300),
        customerName: profile.fullName || user?.fullName || '',
        customerPhone: user?.phone || profile.phone || '',
      });
      setFile(null);
      setNote('');
      setCopies(1);
      router.push(`/print/${job.id}` as Href);
    } catch {
      setProblem('Couldn’t send the job. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <SubHeader title="Print Hub" />
      <Text style={styles.intro}>
        Send a document to a print shop near you. You get a pickup code, and you pay the shop when you collect.
      </Text>

      {needsSignIn ? (
        <Card title="Sign in to print">
          <Text style={styles.muted}>Sign in so the shop can receive your job and you can follow it.</Text>
          <View style={styles.row}>
            <Button label="Sign in" onPress={() => router.push('/sign-in')} />
          </View>
        </Card>
      ) : (
        <>
          <Card title="1. What to print">
            {file ? (
              <View style={styles.fileRow}>
                <Ionicons name={file.mimeType.startsWith('image/') ? 'image' : 'document-text'} size={22} color={Colors.primary} />
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Pressable onPress={() => setFile(null)} hitSlop={6}>
                  <Text style={styles.link}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.row}>
                <Button label="From my Locker" icon="folder-open" variant="secondary" onPress={showLocker} disabled={loadingFile} />
                <Button label="From this phone" icon="document-attach" onPress={fromPhone} busy={loadingFile} />
              </View>
            )}
            {!file &&
              lockerFiles?.map((item) => (
                <Pressable key={item.path} onPress={() => fromLocker(item)} style={({ pressed }) => [styles.lockerRow, pressed && styles.dim]}>
                  <Ionicons name={item.mimeType.startsWith('image/') ? 'image' : 'document-text'} size={18} color={Colors.primary} />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.muted}>{item.category}</Text>
                </Pressable>
              ))}
            {!file && lockerFiles?.length === 0 && <Text style={styles.muted}>Your Locker is empty.</Text>}
            {file && (
              <View style={styles.optionRow}>
                <Text style={styles.label}>Pages</Text>
                <TextInput
                  accessibilityLabel="Pages"
                  value={pages}
                  onChangeText={(t) => setPages(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  style={styles.small}
                />
              </View>
            )}
            {file && !pagesKnown && <Text style={styles.muted}>I couldn’t count the pages in this PDF. Type the number.</Text>}
          </Card>

          <Card title="2. Options">
            <View style={styles.optionRow}>
              <Text style={styles.label}>Copies</Text>
              <View style={styles.stepper}>
                <Pressable accessibilityLabel="Fewer copies" onPress={() => setCopies(Math.max(1, copies - 1))} style={styles.stepButton}>
                  <Ionicons name="remove" size={18} color={Colors.primary} />
                </Pressable>
                <Text style={styles.count}>{copies}</Text>
                <Pressable accessibilityLabel="More copies" onPress={() => setCopies(Math.min(50, copies + 1))} style={styles.stepButton}>
                  <Ionicons name="add" size={18} color={Colors.primary} />
                </Pressable>
              </View>
            </View>
            <View style={styles.chips}>
              {[false, true].map((value) => (
                <Pressable key={String(value)} onPress={() => setColour(value)} style={[styles.chip, colour === value && styles.chipActive]}>
                  <Text style={[styles.chipText, colour === value && styles.chipTextActive]}>{value ? 'Colour' : 'Black and white'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.chips}>
              {[false, true].map((value) => (
                <Pressable key={String(value)} onPress={() => setDoubleSided(value)} style={[styles.chip, doubleSided === value && styles.chipActive]}>
                  <Text style={[styles.chipText, doubleSided === value && styles.chipTextActive]}>{value ? 'Both sides' : 'One side'}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note for the shop (optional), e.g. staple it"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
          </Card>

          <Card title="3. Print shop">
            {shops.length === 0 && <Text style={styles.muted}>No print shops have joined yet.</Text>}
            {sortedShops.map((s) => (
              <Pressable key={s.id} onPress={() => setShopId(s.id)} style={[styles.shop, shopId === s.id && styles.shopActive]}>
                <Ionicons name={shopId === s.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={Colors.primary} />
                <View style={styles.shopText}>
                  <Text style={styles.shopName}>{s.name}</Text>
                  <Text style={styles.muted}>{[s.town, s.county].filter(Boolean).join(', ')}{s.hours ? ` · ${s.hours}` : ''}</Text>
                  <Text style={styles.muted}>
                    {formatKsh(s.priceBw)} a page black and white · {formatKsh(s.priceColour)} colour
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>

          {file && shop && (
            <Card>
              <View style={styles.optionRow}>
                <Text style={styles.label}>Price</Text>
                <Text style={styles.price}>{formatKsh(price)}</Text>
              </View>
              <Text style={styles.muted}>Pay {shop.name} when you collect. The shop confirms the final price.</Text>
            </Card>
          )}
          {!!problem && <Note tone="warn">{problem}</Note>}
          <View style={styles.row}>
            <Button label="Send to print" icon="print" onPress={send} busy={sending} disabled={!file || !shop} />
          </View>

          {jobs.length > 0 && <Text style={styles.heading}>My print jobs</Text>}
          <View style={styles.list}>
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                subtitle={shops.find((s) => s.id === job.shopId)?.name}
                onPress={() => router.push(`/print/${job.id}` as Href)}
              />
            ))}
          </View>
        </>
      )}

      <Pressable onPress={() => router.push('/print/shop')} style={({ pressed }) => [styles.banner, pressed && styles.dim]}>
        <Ionicons name="storefront" size={18} color={Colors.primary} />
        <Text style={styles.bannerText}>Own a cybercafe? Open the shop screen</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.textMuted, lineHeight: 21 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  heading: { fontSize: 17, fontWeight: '700', color: Colors.navy, marginTop: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
  list: { gap: Spacing.md },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fileName: { flex: 1, fontSize: 14, color: Colors.text },
  link: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  lockerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  small: {
    width: 72,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingVertical: 6,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 16, fontWeight: '700', color: Colors.text, minWidth: 20, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: Colors.onDark },
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
  shop: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  shopActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  shopText: { flex: 1, gap: 2 },
  shopName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  price: { fontSize: 20, fontWeight: '700', color: Colors.navy },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  dim: { opacity: 0.7 },
});
