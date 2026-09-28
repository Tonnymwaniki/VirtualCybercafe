import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  formatBytes,
  pickImages,
  processImage,
  shareImage,
  type PickedImage,
  type ProcessedImage,
} from '@/lib/images';

// Common upload limits on Kenyan portals.
const TARGETS_KB = [100, 200, 500, 1000];

export default function CompressScreen() {
  const [targetKb, setTargetKb] = useState(500);
  const [original, setOriginal] = useState<PickedImage | null>(null);
  const [result, setResult] = useState<ProcessedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (image: PickedImage, kb: number) => {
    setBusy(true);
    setError(null);
    try {
      // Smaller targets also need fewer pixels to stay readable at low sizes.
      const maxSide = kb <= 100 ? 1000 : kb <= 200 ? 1400 : 2000;
      setResult(await processImage(image, { maxSide, maxBytes: kb * 1024 }));
    } catch {
      setError('Sorry, that photo could not be processed. Try another one.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    const [image] = await pickImages(source);
    if (!image) return;
    setOriginal(image);
    await run(image, targetKb);
  };

  const chooseTarget = (kb: number) => {
    setTargetKb(kb);
    if (original) run(original, kb);
  };

  return (
    <Screen>
      <SubHeader title="Shrink a Photo" />
      <Text style={styles.intro}>Pick the size limit the website asks for, then choose your photo.</Text>

      <View style={styles.targets}>
        {TARGETS_KB.map((kb) => {
          const active = kb === targetKb;
          return (
            <Pressable
              key={kb}
              onPress={() => chooseTarget(kb)}
              style={[styles.target, active && styles.targetActive]}>
              <Text style={[styles.targetText, active && styles.targetTextActive]}>
                {kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <PickButtons onPick={pick} busy={busy} />
      {error && <Text style={styles.error}>{error}</Text>}

      {original && result && (
        <>
          <View style={styles.fileCard}>
            <Image source={{ uri: `data:image/jpeg;base64,${result.base64}` }} style={styles.preview} />
            <View style={styles.fileText}>
              <Text style={styles.fileName}>photo.jpg</Text>
              <Text style={styles.fileMeta}>
                {formatBytes(original.bytes)} → {formatBytes(result.bytes)}
              </Text>
              <Text style={styles.fileMeta}>
                {result.width} × {result.height}
              </Text>
              <Text style={[styles.status, result.bytes > targetKb * 1024 && styles.statusBad]}>
                {result.bytes <= targetKb * 1024
                  ? `Under ${targetKb >= 1000 ? `${targetKb / 1000} MB` : `${targetKb} KB`}`
                  : 'Still too big. Try a larger limit or a different photo.'}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Button label="Save / share" icon="share-outline" onPress={() => shareImage(result, 'photo.jpg')} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  error: { color: '#DC2626', fontSize: 14 },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  target: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  targetActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  targetText: { fontSize: 14, color: Colors.text },
  targetTextActive: { color: Colors.onDark, fontWeight: '600' },
  fileCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  preview: { width: 110, height: 110, borderRadius: Radius.sm, backgroundColor: Colors.background },
  fileText: { flex: 1, gap: 4 },
  fileName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  fileMeta: { fontSize: 14, color: Colors.textMuted },
  status: { fontSize: 13, fontWeight: '600', color: Colors.success },
  statusBad: { color: '#DC2626' },
  actions: { flexDirection: 'row' },
});
