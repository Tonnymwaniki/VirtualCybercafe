import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { QrCode } from '@/components/print/qr-code';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { FileRow, pagesLabel, Problem, Toggle, workbenchStyles } from '@/components/workbench/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { fileById } from '@/lib/chat-files';
import { useLanguage, type Translate } from '@/lib/i18n';
import { GUEST_ID } from '@/lib/profile-store';
import {
  cancelQuickPrint,
  createQuickPrint,
  displayCode,
  listQuickPrints,
  printPageUrl,
  QuickPrintError,
  siteUrl,
  type QuickPrint,
} from '@/lib/quick-print';
import { supabase } from '@/lib/supabase';
import { pickFiles, type WorkFile } from '@/lib/workbench/files';

function until(t: Translate, iso: string) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString() ? t('print.today', { time }) : t('print.tomorrow', { time });
}

function stateOf(t: Translate, print: QuickPrint) {
  return print.openedAt ? t('print.opened') : t('print.waiting');
}

// Print at any cyber: the file gets a short code and a QR code. The cyber
// opens the print page, types the code (or scans), prints, and taps Printed.
export default function PrintByCodeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.id ?? GUEST_ID;
  const params = useLocalSearchParams<{ file?: string }>();
  const [file, setFile] = useState<WorkFile | null>(() => (params.file ? fileById(params.file) ?? null : null));
  const [usePin, setUsePin] = useState<'no' | 'yes'>('no');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [made, setMade] = useState<QuickPrint | null>(null);
  const [codes, setCodes] = useState<QuickPrint[]>([]);

  const needsSignIn = !!supabase && !user;

  const refresh = useCallback(() => {
    if (needsSignIn) return;
    listQuickPrints().then(setCodes).catch(() => {});
  }, [needsSignIn]);
  useFocusEffect(refresh);

  const choose = async () => {
    const [picked] = await pickFiles({ pdf: true, images: true });
    if (picked) {
      setFile(picked);
      setMade(null);
      setProblem('');
    }
  };

  const make = async () => {
    if (!file) return;
    if (usePin === 'yes' && !/^\d{4}$/.test(pin)) {
      setProblem(t('print.pinError'));
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      const print = await createQuickPrint(userId, file, usePin === 'yes' ? pin : undefined);
      setMade(print);
      refresh();
    } catch (error) {
      setProblem(error instanceof QuickPrintError ? error.message : t('print.failed'));
    } finally {
      setBusy(false);
    }
  };

  const share = (print: QuickPrint) => {
    const message = t('print.shareMessage', {
      url: printPageUrl(),
      code: displayCode(print.code),
      pin: print.hasPin ? t('print.sharePin') : '',
      scan: printPageUrl(print.code),
    });
    // Browsers without a share sheet get it copied instead.
    Share.share({ message }).catch(() => Clipboard.setStringAsync(message).catch(() => {}));
  };

  const cancel = async (print: QuickPrint) => {
    await cancelQuickPrint(print).catch(() => {});
    if (made?.id === print.id) setMade(null);
    refresh();
  };

  return (
    <Screen>
      <SubHeader title={t('wb.printAnyCyber')} />
      <Text style={workbenchStyles.intro}>{t('print.intro')}</Text>

      {needsSignIn ? (
        <View style={styles.card}>
          <Text style={styles.text}>{t('print.signInNote')}</Text>
          <Button label={t('common.signIn')} icon="log-in" onPress={() => router.push('/sign-in')} />
        </View>
      ) : made ? (
        <View style={styles.ticket}>
          <Text style={styles.kicker}>{t('print.yourCode')}</Text>
          <QrCode value={printPageUrl(made.code)} size={200} />
          <Text style={styles.code} selectable>
            {displayCode(made.code)}
          </Text>
          <Text style={styles.fileLine} numberOfLines={1}>
            {made.fileName} · {pagesLabel(t, made.pages)}
          </Text>
          <View style={styles.how}>
            <Text style={styles.text}>{t('print.howStart')}</Text>
            <Text style={styles.link} selectable>
              {printPageUrl()}
            </Text>
            <Text style={styles.text}>{made.hasPin ? t('print.howEndPin') : t('print.howEnd')}</Text>
          </View>
          <Text style={styles.muted}>{t('print.worksUntil', { when: until(t, made.expiresAt) })}</Text>
          <View style={workbenchStyles.row}>
            <Button label={t('print.share')} icon="share-social" onPress={() => share(made)} />
            <Button label={t('print.another')} icon="add" variant="secondary" onPress={() => { setMade(null); setFile(null); }} />
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          {file ? (
            <FileRow file={file} onRemove={() => setFile(null)} />
          ) : (
            <Button label={t('print.choose')} icon="document-attach" onPress={choose} />
          )}
          {file?.kind === 'image' && <Text style={styles.muted}>{t('print.photoNote')}</Text>}
          <Text style={workbenchStyles.label}>{t('print.pin')}</Text>
          <Toggle
            options={[
              { value: 'no', label: t('print.noPin') },
              { value: 'yes', label: t('print.addPin') },
            ]}
            value={usePin}
            onChange={(v) => setUsePin(v as 'no' | 'yes')}
          />
          {usePin === 'yes' && (
            <>
              <TextInput
                value={pin}
                onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                placeholder={t('print.pinPlaceholder')}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                style={[workbenchStyles.input, styles.pin]}
              />
              <Text style={styles.muted}>{t('print.pinNote')}</Text>
            </>
          )}
          {!!problem && <Problem text={problem} />}
          <Button label={t('print.makeCode')} icon="qr-code" onPress={make} busy={busy} disabled={!file} />
        </View>
      )}

      {codes.filter((c) => c.id !== made?.id).length > 0 && (
        <View style={styles.list}>
          <Text style={styles.groupTitle}>{t('print.yourCodes')}</Text>
          {codes
            .filter((c) => c.id !== made?.id)
            .map((print) => (
              <View key={print.id} style={styles.row}>
                <Ionicons name="qr-code" size={22} color={Colors.primary} />
                <Pressable style={styles.flex} onPress={() => setMade(print)}>
                  <Text style={styles.rowTitle}>
                    {displayCode(print.code)} · {print.fileName}
                  </Text>
                  <Text style={styles.muted}>
                    {t('print.stateUntil', { state: stateOf(t, print), when: until(t, print.expiresAt) })}
                  </Text>
                </Pressable>
                <Pressable onPress={() => cancel(print)} hitSlop={6}>
                  <Text style={styles.cancel}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            ))}
        </View>
      )}
      {!needsSignIn && !supabase && (
        <Text style={styles.muted}>{t('print.demo', { site: siteUrl() })}</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg },
  ticket: { gap: Spacing.md, alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.primary, padding: Spacing.lg },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: Colors.primary },
  code: { fontSize: 34, fontWeight: '800', letterSpacing: 3, color: Colors.navy },
  fileLine: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  how: { alignItems: 'center', gap: 2 },
  text: { fontSize: 14, color: Colors.text, lineHeight: 20, textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  pin: { width: 140, letterSpacing: 6, fontSize: 20 },
  list: { gap: Spacing.sm },
  groupTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  flex: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cancel: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
});
