import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { PickButtons } from '@/components/pick-buttons';
import { PhotoCheckCard } from '@/components/workbench/photo-check';
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
import { fromBase64 } from '@/lib/workbench/files';

// eCitizen passport photo rules as shown in the design.
const SIDE = 600;
const MAX_BYTES = 200 * 1024;

type Check = { label: string; ok: boolean | 'manual' };

function checksFor(original: PickedImage, photo: ProcessedImage): Check[] {
  return [
    { label: `Dimensions: ${photo.width} × ${photo.height}`, ok: photo.width === SIDE && photo.height === SIDE },
    { label: `File size: ${formatBytes(photo.bytes)} (max 200 KB)`, ok: photo.bytes <= MAX_BYTES },
    { label: 'Format: JPG', ok: true },
    {
      label: 'Quality: original is sharp enough',
      ok: Math.min(original.width, original.height) >= SIDE,
    },
    { label: 'Background: plain white (check yourself)', ok: 'manual' },
    { label: 'Face centred and looking at the camera (check yourself)', ok: 'manual' },
  ];
}

export default function PassportPhotoScreen() {
  const [original, setOriginal] = useState<PickedImage | null>(null);
  const [photo, setPhoto] = useState<ProcessedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    const [image] = await pickImages(source);
    if (!image) return;
    setBusy(true);
    try {
      setOriginal(image);
      setPhoto(await processImage(image, { square: true, maxSide: SIDE, maxBytes: MAX_BYTES }));
    } catch {
      setError('Sorry, that photo could not be processed. Try another one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SubHeader title="Passport Photo" />
      <Text style={styles.intro}>
        Use a clear photo of your face on a plain white background. We crop it square, resize it to
        600 × 600 and shrink it under 200 KB.
      </Text>

      <PickButtons onPick={pick} busy={busy} />
      {error && <Text style={styles.error}>{error}</Text>}

      {original && photo && (
        <>
          <View style={styles.fileCard}>
            <Image source={{ uri: `data:image/jpeg;base64,${photo.base64}` }} style={styles.preview} />
            <View style={styles.fileText}>
              <Text style={styles.fileName}>passport-photo.jpg</Text>
              <Text style={styles.fileMeta}>
                {formatBytes(original.bytes)} → {formatBytes(photo.bytes)}
              </Text>
            </View>
          </View>

          {photo.bytes <= MAX_BYTES && (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.successText}>
                Photo has been resized and compressed to meet requirements.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Requirements</Text>
          <View style={styles.checks}>
            {checksFor(original, photo).map((check) => (
              <View key={check.label} style={styles.checkRow}>
                <Ionicons
                  name={check.ok === 'manual' ? 'eye' : check.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={check.ok === 'manual' ? Colors.textMuted : check.ok ? Colors.success : '#DC2626'}
                />
                <Text style={styles.checkText}>{check.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              label="Save / share"
              icon="share-outline"
              onPress={() => shareImage(photo, 'passport-photo.jpg')}
            />
          </View>
          <PhotoCheckCard
            key={photo.uri}
            file={{ name: 'passport-photo.jpg', kind: 'image', mimeType: 'image/jpeg', bytes: fromBase64(photo.base64), uri: photo.uri, width: photo.width, height: photo.height }}
            checks={['face', 'whiteBackground', 'noGlasses', 'sharp']}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  error: { color: '#DC2626', fontSize: 14 },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  preview: { width: 96, height: 96, borderRadius: Radius.sm, backgroundColor: Colors.background },
  fileText: { flex: 1, gap: 4 },
  fileName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  fileMeta: { fontSize: 14, color: Colors.textMuted },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#EAF7EF',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  successText: { flex: 1, fontSize: 13, color: Colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  checks: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkText: { flex: 1, fontSize: 14, color: Colors.text },
  actions: { flexDirection: 'row', gap: Spacing.md },
});
