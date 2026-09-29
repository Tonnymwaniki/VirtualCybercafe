import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Note } from '@/components/gov/ui';
import { Spacing } from '@/constants/theme';
import { useLanguage } from '@/lib/i18n';
import { canUseCamera, pickImages, processImage } from '@/lib/images';
import { readOldCv } from '@/lib/jobs-client';
import { pickFiles, toBase64 } from '@/lib/workbench/files';

const MAX_PDF_BYTES = 3_000_000;

type Props = {
  // Gets the details read from the CV; returns how many it filled.
  onFound: (details: Record<string, string>) => number;
};

// "Import my old CV": a photo or PDF of an old CV fills My Details (career,
// education, skills, contacts) for the person to check and save.
export function CvImport({ onFound }: Props) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<{ text: string; good?: boolean }[]>([]);

  const read = async (file: { image?: string; pdf?: string }) => {
    setBusy(true);
    setNotes([]);
    try {
      const result = await readOldCv(file);
      const filled = Object.keys(result.details).length ? onFound(result.details) : 0;
      const found = Object.keys(result.details).length;
      setNotes([
        ...(filled ? [{ text: filled === 1 ? t('profile.cvFilledOne') : t('profile.cvFilled', { n: filled }), good: true }] : []),
        ...(found > filled ? [{ text: found - filled === 1 ? t('profile.cvKeptOne') : t('profile.cvKept', { n: found - filled }) }] : []),
        ...result.problems.map((text) => ({ text })),
      ]);
    } finally {
      setBusy(false);
    }
  };

  const fromPhoto = async (source: 'camera' | 'library') => {
    const [photo] = await pickImages(source);
    if (!photo) return;
    setBusy(true);
    try {
      const image = await processImage(photo, { maxSide: 2000, maxBytes: 1_500_000 });
      await read({ image: image.base64 });
    } catch {
      setNotes([{ text: t('profile.cvPhotoFailed') }]);
      setBusy(false);
    }
  };

  const fromPdf = async () => {
    const [file] = await pickFiles({ pdf: true });
    if (!file) return;
    if (file.bytes.byteLength > MAX_PDF_BYTES) {
      setNotes([{ text: t('profile.cvTooBig') }]);
      return;
    }
    await read({ pdf: toBase64(file.bytes) });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button label={t('profile.cvChoosePdf')} icon="document-text" onPress={fromPdf} busy={busy} />
        <Button label={t('profile.cvPhoto')} icon={canUseCamera ? 'camera' : 'images'} variant="secondary" onPress={() => fromPhoto(canUseCamera ? 'camera' : 'library')} disabled={busy} />
      </View>
      {notes.map((note) => (
        <Note key={note.text} tone={note.good ? 'good' : 'warn'}>
          {note.text}
        </Note>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
});
