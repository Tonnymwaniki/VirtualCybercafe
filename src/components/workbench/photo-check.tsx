import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { PhotoCheck } from '@/data/presets';
import { useLanguage, type Translate } from '@/lib/i18n';
import { checkPhotoAi } from '@/lib/photo-check-client';
import type { PhotoVerdict } from '@/lib/photo-check-types';
import type { WorkFile } from '@/lib/workbench/files';

type Row = { ok: boolean; label: string };

function rowsFor(t: Translate, verdict: Extract<PhotoVerdict, { available: true }>, wanted: PhotoCheck[]): Row[] {
  const rows: Row[] = [];
  if (wanted.includes('face')) {
    rows.push({ ok: verdict.onePerson, label: verdict.onePerson ? t('photo.onePerson') : t('photo.needOnePerson') });
    rows.push({ ok: verdict.faceCentred, label: verdict.faceCentred ? t('photo.centred') : t('photo.notCentred') });
  }
  if (wanted.includes('whiteBackground')) {
    const ok = verdict.background === 'white';
    rows.push({ ok, label: ok ? t('photo.white') : t('photo.needWhite') });
  } else if (wanted.includes('plainBackground')) {
    const ok = verdict.background !== 'busy';
    rows.push({ ok, label: ok ? t('photo.plain') : t('photo.needPlain') });
  }
  if (wanted.includes('noGlasses')) rows.push({ ok: !verdict.glasses, label: verdict.glasses ? t('photo.removeGlasses') : t('photo.noGlasses') });
  if (wanted.includes('sharp')) rows.push({ ok: verdict.sharp, label: verdict.sharp ? t('photo.sharp') : t('photo.blurry') });
  return rows;
}

// "Check the photo" with the AI: what it shows, not its size. Costs about
// one chat message, so it runs only when the person taps.
export function PhotoCheckCard({ file, checks }: { file: WorkFile; checks: PhotoCheck[] }) {
  const { t } = useLanguage();
  const [verdict, setVerdict] = useState<PhotoVerdict | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    setVerdict(await checkPhotoAi(file));
    setBusy(false);
  };
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="sparkles" size={18} color={Colors.primary} />
        <Text style={styles.title}>{t('photo.title')}</Text>
      </View>
      {!verdict && (
        <>
          <Text style={styles.text}>{t('photo.intro')}</Text>
          <View style={styles.row}>
            <Button label={t('photo.button')} icon="eye" variant="secondary" onPress={run} busy={busy} />
          </View>
        </>
      )}
      {verdict && !verdict.available && <Text style={styles.text}>{verdict.reason ?? t('photo.unavailable')}</Text>}
      {verdict?.available && (
        <>
          {rowsFor(t, verdict, checks).map((row) => (
            <View key={row.label} style={styles.check}>
              <Ionicons name={row.ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={row.ok ? Colors.success : '#DC2626'} />
              <Text style={styles.checkText}>{row.label}</Text>
            </View>
          ))}
          {verdict.tips.map((tip) => (
            <Text key={tip} style={styles.tip}>
              • {tip}
            </Text>
          ))}
          <Text style={styles.small}>{t('photo.disclaimer')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  text: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  row: { flexDirection: 'row' },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkText: { fontSize: 15, color: Colors.text },
  tip: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  small: { fontSize: 12, color: Colors.textMuted },
});
