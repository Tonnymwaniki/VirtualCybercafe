import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { useEngine, type ScanFilter } from '@/components/workbench/engine';
import { checksFor, Problem, ResultCard, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { pickImages } from '@/lib/images';
import { fileUri, renamed, type WorkFile } from '@/lib/workbench/files';
import { editImage, imageFromPicked } from '@/lib/workbench/image';
import { joinFiles } from '@/lib/workbench/pdf';

type Look = 'original' | ScanFilter;

const LOOKS: { value: Look; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'enhance', label: 'Brighter' },
  { value: 'clean', label: 'Clean' },
  { value: 'bw', label: 'Black & white' },
];

type Page = { source: WorkFile; rotate: number; look: Look; view: WorkFile };

// Scans are kept this size: sharp enough to read and print, small to upload.
const MAX_SIDE = 2200;

export default function ScanScreen() {
  const engine = useEngine();
  const [pages, setPages] = useState<Page[]>([]);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<WorkFile | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const draw = async (source: WorkFile, rotate: number, look: Look) => {
    const turned = await editImage(source, { rotate, maxSide: MAX_SIDE }, 'jpg', 0.9);
    if (look === 'original') return turned;
    return engine.filterImage(turned, look);
  };

  const add = async (from: 'camera' | 'library') => {
    setProblem(null);
    // Android lets the person crop right after taking the photo.
    const picked = await pickImages(from, from === 'library', from === 'camera' && Platform.OS === 'android');
    if (!picked.length) return;
    setBusy('Cleaning up…');
    try {
      const added: Page[] = [];
      for (const image of picked) {
        const source = await imageFromPicked(image);
        added.push({ source, rotate: 0, look: 'clean', view: await draw(source, 0, 'clean') });
      }
      setCurrent(pages.length);
      setPages((list) => [...list, ...added]);
      setResult(null);
    } catch {
      setProblem('That photo couldn’t be cleaned up. Try another one.');
    } finally {
      setBusy(null);
    }
  };

  const change = async (update: Partial<Pick<Page, 'rotate' | 'look'>>) => {
    const page = pages[current];
    if (!page) return;
    const next = { ...page, ...update };
    setBusy('Updating…');
    try {
      const view = await draw(next.source, next.rotate, next.look);
      setPages((list) => list.map((p, i) => (i === current ? { ...next, view } : p)));
      setResult(null);
    } catch {
      setProblem('That didn’t work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    setPages((list) => list.filter((_, i) => i !== current));
    setCurrent((i) => Math.max(0, i - 1));
    setResult(null);
  };

  const finish = async (as: 'pdf' | 'jpg') => {
    setBusy('Saving…');
    setProblem(null);
    try {
      if (as === 'jpg') setResult({ ...pages[0].view, name: renamed('scan.jpg', '', 'jpg') });
      else setResult(await joinFiles(pages.map((p) => p.view), 'scan.pdf'));
    } catch {
      setProblem('The file couldn’t be made. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const page = pages[current];

  return (
    <Screen>
      <SubHeader title="Scan a document" />
      <Text style={ui.intro}>
        Take a photo of each page flat, in good light. Clean makes the paper white and the writing dark.
        {Platform.OS === 'android' ? ' After each photo you can crop it to the page edges.' : ''}
      </Text>
      <PickButtons onPick={add} busy={!!busy} libraryLabel={pages.length ? 'Add page' : 'Choose photo'} />

      {page && (
        <View style={styles.editor}>
          <Image source={{ uri: fileUri(page.view) }} style={[styles.preview, { aspectRatio: (page.view.width ?? 3) / (page.view.height ?? 4) }]} resizeMode="contain" />
          <View style={styles.tools}>
            <Pressable accessibilityLabel="Turn left" onPress={() => change({ rotate: (page.rotate + 270) % 360 })} style={styles.tool}>
              <Ionicons name="arrow-undo" size={20} color={Colors.primary} />
            </Pressable>
            <Pressable accessibilityLabel="Turn right" onPress={() => change({ rotate: (page.rotate + 90) % 360 })} style={styles.tool}>
              <Ionicons name="arrow-redo" size={20} color={Colors.primary} />
            </Pressable>
            <Pressable accessibilityLabel="Remove page" onPress={remove} style={styles.tool}>
              <Ionicons name="trash" size={20} color="#DC2626" />
            </Pressable>
          </View>
          <View style={styles.looks}>
            {LOOKS.map((look) => (
              <Pressable key={look.value} onPress={() => change({ look: look.value })} style={[styles.look, page.look === look.value && styles.lookActive]}>
                <Text style={[styles.lookText, page.look === look.value && styles.lookTextActive]}>{look.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {pages.length > 1 && (
        <ScrollView horizontal contentContainerStyle={styles.strip} showsHorizontalScrollIndicator={false}>
          {pages.map((p, i) => (
            <Pressable key={i} onPress={() => setCurrent(i)} style={[styles.stripItem, i === current && styles.stripActive]} accessibilityLabel={`Page ${i + 1}`}>
              <Image source={{ uri: fileUri(p.view) }} style={styles.stripThumb} resizeMode="cover" />
              <Text style={styles.stripNumber}>{i + 1}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {busy && <Working text={busy} />}
      {problem && <Problem text={problem} />}
      {pages.length > 0 && (
        <View style={ui.row}>
          <Button label={`Save as PDF (${pages.length} page${pages.length === 1 ? '' : 's'})`} icon="document" onPress={() => finish('pdf')} disabled={!!busy} />
          {pages.length === 1 && <Button label="Save as JPG" icon="image" variant="secondary" onPress={() => finish('jpg')} disabled={!!busy} />}
        </View>
      )}
      {result && <ResultCard file={result} checks={checksFor(result)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  editor: { gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  preview: { width: '100%', maxHeight: 420, backgroundColor: Colors.background, borderRadius: Radius.sm },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
  tool: { padding: Spacing.sm, borderRadius: Radius.pill, backgroundColor: Colors.primarySoft },
  looks: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
  look: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  lookActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  lookText: { fontSize: 13, color: Colors.text },
  lookTextActive: { color: Colors.onDark, fontWeight: '600' },
  strip: { gap: Spacing.sm },
  stripItem: { borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.border, padding: 2, alignItems: 'center' },
  stripActive: { borderColor: Colors.primary },
  stripThumb: { width: 54, height: 70, borderRadius: 4 },
  stripNumber: { fontSize: 11, fontWeight: '700', color: Colors.text },
});
