import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatBytes, pickImages, processImage, sharePdfFromImages, type ProcessedImage } from '@/lib/images';

// Pages are resized so the PDF stays small enough to upload.
const PAGE_MAX_SIDE = 1600;

export default function PhotosToPdfScreen() {
  const [pages, setPages] = useState<ProcessedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (source: 'camera' | 'library') => {
    setError(null);
    const picked = await pickImages(source, true);
    if (picked.length === 0) return;
    setBusy(true);
    try {
      const processed = await Promise.all(
        picked.map((image) => processImage(image, { maxSide: PAGE_MAX_SIDE })),
      );
      setPages((current) => [...current, ...processed]);
    } catch {
      setError('Sorry, one of those photos could not be processed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (index: number) => setPages((current) => current.filter((_, i) => i !== index));

  const exportPdf = async () => {
    setExporting(true);
    try {
      await sharePdfFromImages(pages);
    } catch {
      setError('Sorry, the PDF could not be created.');
    } finally {
      setExporting(false);
    }
  };

  const total = pages.reduce((sum, page) => sum + page.bytes, 0);

  return (
    <Screen>
      <SubHeader title="Photos to PDF" />
      <Text style={styles.intro}>
        Add photos of your documents in order. Each photo becomes one page of the PDF.
      </Text>

      <PickButtons onPick={add} busy={busy} libraryLabel="Add photos" />
      {error && <Text style={styles.error}>{error}</Text>}

      {pages.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            {pages.length} {pages.length === 1 ? 'page' : 'pages'} · about {formatBytes(total)}
          </Text>
          <View style={styles.grid}>
            {pages.map((page, index) => (
              <View key={`${page.uri}-${index}`} style={styles.thumbWrap}>
                <Image source={{ uri: `data:image/jpeg;base64,${page.base64}` }} style={styles.thumb} />
                <Text style={styles.pageNumber}>{index + 1}</Text>
                <Pressable
                  accessibilityLabel={`Remove page ${index + 1}`}
                  onPress={() => remove(index)}
                  style={styles.remove}>
                  <Ionicons name="close" size={14} color={Colors.onDark} />
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <Button label="Create PDF" icon="document-attach" onPress={exportPdf} busy={exporting} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  error: { color: '#DC2626', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  thumbWrap: { width: 100 },
  thumb: {
    width: 100,
    height: 130,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  pageNumber: { textAlign: 'center', marginTop: 4, fontSize: 12, color: Colors.textMuted },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row' },
});
