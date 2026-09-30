import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Mascot } from '@/components/mascot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { displayCode, openQuickPrint, type OpenResult } from '@/lib/quick-print';
import { formatSize } from '@/lib/workbench/files';

type Found = Extract<OpenResult, { status: 'ok' }>;

const messages: Record<string, string> = {
  not_found: 'No document has that code. Check the code with the customer. Codes last 24 hours and stop working once printed.',
  locked: 'Too many wrong PINs. Ask the customer to make a new print code.',
  slow_down: 'Too many wrong codes from this connection. Wait an hour and try again.',
  offline: 'Couldn’t reach Virtual Cybercafe. Check the internet connection and try again.',
};

// Opens a file in a new tab. Demo files are data links, which browsers
// won't open directly, so they become blob links first.
async function openLink(url: string, download?: string) {
  if (Platform.OS !== 'web') {
    await Linking.openURL(url);
    return;
  }
  let href = url;
  if (url.startsWith('data:')) href = URL.createObjectURL(await (await fetch(url)).blob());
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  if (download) link.download = download;
  link.click();
}

// The public print page a cyber opens from the customer's QR code or by
// typing the address. No account is needed.
export function CyberPrint({ initialCode = '' }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [pin, setPin] = useState('');
  const [askPin, setAskPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [printed, setPrinted] = useState(false);

  const check = async (withCode = code) => {
    if (!withCode.trim()) return;
    setBusy(true);
    setProblem('');
    const result = await openQuickPrint(withCode, askPin ? pin : undefined);
    setBusy(false);
    if (result.status === 'ok') setFound(result);
    else if (result.status === 'pin_needed') setAskPin(true);
    else if (result.status === 'wrong_pin') setProblem(`Wrong PIN. ${result.triesLeft} ${result.triesLeft === 1 ? 'try' : 'tries'} left.`);
    else setProblem(messages[result.status] ?? messages.not_found);
  };

  // Opened from the QR code: look the code up straight away.
  useEffect(() => {
    if (initialCode) check(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const finish = async () => {
    setBusy(true);
    const result = await openQuickPrint(code, askPin ? pin : undefined, true);
    setBusy(false);
    if (result.status === 'printed') setPrinted(true);
    else setProblem(messages[result.status] ?? 'Couldn’t close the code. Try again.');
  };

  const shown = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().replace(/^VC(?=.{6}$)/, '');

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Mascot size={44} />
          <View>
            <Text style={styles.brandName}>Virtual Cybercafe</Text>
            <Text style={styles.brandSub}>Print a customer’s document</Text>
          </View>
        </View>

        {printed ? (
          <View style={styles.card}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            <Text style={styles.title}>Done. Thank you!</Text>
            <Text style={styles.text}>The code is closed and the customer’s file will be deleted. Collect payment as usual.</Text>
            <Button label="Print another" icon="refresh" variant="secondary" onPress={() => { setFound(null); setPrinted(false); setCode(''); setPin(''); setAskPin(false); }} />
          </View>
        ) : found ? (
          <View style={styles.card}>
            <Text style={styles.kicker}>{displayCode(shown)}</Text>
            <View style={styles.fileRow}>
              <Ionicons name="document-text" size={36} color="#DC2626" />
              <View style={styles.flex}>
                <Text style={styles.fileName}>{found.fileName}</Text>
                <Text style={styles.muted}>
                  PDF · {found.pages} page{found.pages === 1 ? '' : 's'} · {formatSize(found.bytes)}
                </Text>
              </View>
            </View>
            <View style={styles.steps}>
              <Text style={styles.text}>1. Open the document and print it (Ctrl + P).</Text>
              <Text style={styles.text}>2. Hand it to the customer and collect payment as usual.</Text>
              <Text style={styles.text}>3. Tap Printed so the file is deleted.</Text>
            </View>
            <View style={styles.row}>
              <Button label="Open to print" icon="print" onPress={() => openLink(found.url)} />
              <Button label="Download" icon="download" variant="secondary" onPress={() => openLink(found.downloadUrl, found.fileName)} />
            </View>
            {!!problem && <Text style={styles.problem}>{problem}</Text>}
            <Button label="Printed" icon="checkmark-done" variant="secondary" onPress={finish} busy={busy} />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>Type the customer’s print code</Text>
            <Text style={styles.muted}>It looks like VC-7K2M9Q. The customer sees it in their Virtual Cybercafe app.</Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder="VC-______"
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={() => check()}
              style={styles.codeInput}
              accessibilityLabel="Print code"
            />
            {askPin && (
              <>
                <Text style={styles.text}>This document has a PIN. Ask the customer for it.</Text>
                <TextInput
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                  placeholder="PIN"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  onSubmitEditing={() => check()}
                  style={[styles.codeInput, styles.pinInput]}
                  accessibilityLabel="PIN"
                />
              </>
            )}
            {!!problem && <Text style={styles.problem}>{problem}</Text>}
            <Button label="Open document" icon="arrow-forward" onPress={() => check()} busy={busy} disabled={!code.trim() || (askPin && pin.length !== 4)} />
          </View>
        )}
        <Text style={styles.footer}>No account needed. Files are private to the customer and are deleted after printing or after 24 hours.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  brandName: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  brandSub: { fontSize: 13, color: Colors.textMuted },
  card: { gap: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, alignItems: 'stretch' },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: Colors.primary },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  text: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  problem: { fontSize: 14, color: '#DC2626', lineHeight: 20 },
  codeInput: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    color: Colors.navy,
    textAlign: 'center',
  },
  pinInput: { fontSize: 24, letterSpacing: 10 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  fileName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  steps: { gap: 4 },
  row: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  footer: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
