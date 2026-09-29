import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { PhotoCheckCard } from '@/components/workbench/photo-check';
import { checksFor, Problem, ResultCard, Toggle, Working, workbenchStyles } from '@/components/workbench/ui';
import { Colors, Spacing } from '@/constants/theme';
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
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [digital, setDigital] = useState<{ file: WorkFile; sharpEnough: boolean } | null>(null);
  const [sheet, setSheet] = useState<WorkFile | null>(null);
  const [size, setSize] = useState<PrintSize>('kenya');
  const [busy, setBusy] = useState<'photo' | 'sheet' | null>(null);
  const [error, setError] = useState('');

  const makeSheet = async (from: WorkFile, printSize: PrintSize) => {
    setBusy('sheet');
    try {
      setSheet(await passportSheet(from, printSize));
    } catch {
      setError('The print sheet couldn’t be made. Try another photo.');
    } finally {
      setBusy(null);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    setError('');
    const [picked] = await pickImages(source);
    if (!picked) return;
    setBusy('photo');
    setDigital(null);
    setSheet(null);
    try {
      const file = await imageFromPicked(picked);
      setOriginal(file);
      setDigital(await digitalPassport(file));
      await makeSheet(file, size);
    } catch {
      setError('Sorry, that photo could not be processed. Try another one.');
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
      <SubHeader title="Passport photo" />
      <Text style={workbenchStyles.intro}>
        Stand in front of a plain white wall in good light, look straight at the camera, no glasses or hat. You get the digital photo for online forms and a sheet of print photos for any cyber.
      </Text>

      <PickButtons onPick={pick} busy={busy === 'photo'} />
      {busy === 'photo' && <Working text="Making your passport photo…" />}
      {!!error && <Problem text={error} />}

      {digital && (
        <>
          <Text style={styles.sectionTitle}>For online forms</Text>
          <ResultCard
            file={digital.file}
            before={original ?? undefined}
            title="Passport photo ready"
            checks={[
              ...checksFor(digital.file, { maxBytes: PASSPORT_MAX_BYTES, width: PASSPORT_SIDE, height: PASSPORT_SIDE }),
              {
                ok: digital.sharpEnough,
                label: digital.sharpEnough ? 'Original is sharp enough' : 'The original photo is small; take a closer, sharper one',
              },
            ]}
            note="Cropped to your face from the middle of the photo. Check nothing was cut off; your face must be exactly as it is, so it isn’t edited."
          />
          <PhotoCheckCard key={digital.file.name + digital.file.bytes.byteLength} file={digital.file} checks={['face', 'whiteBackground', 'noGlasses', 'sharp']} />
        </>
      )}

      {original && (
        <>
          <Text style={styles.sectionTitle}>To print at a cyber</Text>
          <Toggle
            options={[
              { value: 'kenya', label: '2 × 2 in (passport)' },
              { value: 'visa', label: '35 × 45 mm' },
            ]}
            value={size}
            onChange={changeSize}
          />
          {busy === 'sheet' && <Working text="Making the print sheet…" />}
          {sheet && busy !== 'sheet' && (
            <ResultCard
              file={sheet}
              title="Print sheet ready"
              checks={[
                { ok: true, label: 'A4 PDF, 1 page' },
                { ok: true, label: `${spec.rows * spec.columns} photos at ${spec.label}` },
              ]}
              note="Ask the cyber to print at actual size (100%), not “fit to page”, on photo paper if they have it. Tap Print at any cyber to get a code for them."
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
