import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { PhotoCheckCard } from '@/components/workbench/photo-check';
import { checksFor, Problem, type ProblemValue, ResultCard, Toggle, Working, workbenchStyles } from '@/components/workbench/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useLanguage } from '@/lib/i18n';
import { explainError } from '@/lib/workbench/explain';
import { pickImages } from '@/lib/images';
import type { WorkFile } from '@/lib/workbench/files';
import { imageFromPicked } from '@/lib/workbench/image';
import {
  digitalPassport,
  PASSPORT_MAX_BYTES,
  PASSPORT_SIDE,
  passportSheet,
  printSizes,
  type PrintSize,
} from '@/lib/workbench/passport';

// A passport photo from any clear photo: the digital photo for online forms
// (600 × 600 JPG under 200 KB) and an A4 sheet of print photos for a cyber
// to print and cut.
export default function PassportPhotoScreen() {
  const { t } = useLanguage();
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [digital, setDigital] = useState<{ file: WorkFile; sharpEnough: boolean } | null>(null);
  const [sheet, setSheet] = useState<WorkFile | null>(null);
  const [size, setSize] = useState<PrintSize>('kenya');
  const [busy, setBusy] = useState<'photo' | 'sheet' | null>(null);
  const [error, setError] = useState<ProblemValue | ''>('');

  const makeSheet = async (from: WorkFile, printSize: PrintSize) => {
    setBusy('sheet');
    try {
      setSheet(await passportSheet(from, printSize));
    } catch (problem) {
      setError(explainError(problem, 'passport', t, [from]));
    } finally {
      setBusy(null);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    setError('');
    let file: WorkFile | undefined;
    try {
      const [picked] = await pickImages(source);
      if (!picked) return;
      setBusy('photo');
      setDigital(null);
      setSheet(null);
      file = await imageFromPicked(picked);
      setOriginal(file);
      setDigital(await digitalPassport(file));
      await makeSheet(file, size);
    } catch (problem) {
      setError(explainError(problem, 'passport', t, [file]));
    } finally {
      setBusy(null);
    }
  };

  const changeSize = (value: string) => {
    setSize(value as PrintSize);
    if (original) makeSheet(original, value as PrintSize);
  };

  const spec = printSizes[size];

  return (
    <Screen>
      <SubHeader title={t('wb.passport.title')} />
      <Text style={workbenchStyles.intro}>{t('wb.passport.intro')}</Text>

      <PickButtons onPick={pick} busy={busy === 'photo'} libraryLabel={t('wb.choosePhoto')} />
      {busy === 'photo' && <Working text={t('wb.passport.making')} />}
      {!!error && <Problem text={error} />}

      {digital && (
        <>
          <Text style={styles.sectionTitle}>{t('wb.passport.online')}</Text>
          <ResultCard
            file={digital.file}
            before={original ?? undefined}
            title={t('wb.passport.ready')}
            checks={[
              ...checksFor(digital.file, { maxBytes: PASSPORT_MAX_BYTES, width: PASSPORT_SIDE, height: PASSPORT_SIDE }, t),
              {
                ok: digital.sharpEnough,
                label: digital.sharpEnough ? t('wb.passport.sharp') : t('wb.passport.small'),
              },
            ]}
            note={t('wb.passport.note')}
          />
          <PhotoCheckCard key={digital.file.name + digital.file.bytes.byteLength} file={digital.file} checks={['face', 'whiteBackground', 'noGlasses', 'sharp']} />
        </>
      )}

      {original && (
        <>
          <Text style={styles.sectionTitle}>{t('wb.passport.toPrint')}</Text>
          <Toggle
            options={[
              { value: 'kenya', label: t('wb.passport.sizePassport') },
              { value: 'visa', label: '35 × 45 mm' },
            ]}
            value={size}
            onChange={changeSize}
          />
          {busy === 'sheet' && <Working text={t('wb.passport.makingSheet')} />}
          {sheet && busy !== 'sheet' && (
            <ResultCard
              file={sheet}
              title={t('wb.passport.sheetReady')}
              checks={[
                { ok: true, label: t('wb.passport.sheetPage') },
                { ok: true, label: t('wb.passport.photosAt', { n: spec.rows * spec.columns, size: spec.label }) },
              ]}
              note={t('wb.passport.sheetNote')}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.sm },
});
