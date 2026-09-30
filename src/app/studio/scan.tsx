import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { useEngine, type ScanFilter } from '@/components/workbench/engine';
import { checksFor, Problem, type ProblemValue, ResultCard, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLanguage, type TextKey } from '@/lib/i18n';
import { explainError } from '@/lib/workbench/explain';
import { pickImages } from '@/lib/images';
import { fileUri, renamed, type WorkFile } from '@/lib/workbench/files';
import { editImage, imageFromPicked } from '@/lib/workbench/image';
import { joinFiles } from '@/lib/workbench/pdf';

type Look = 'original' | ScanFilter;

const LOOKS: { value: Look; label: TextKey }[] = [
  { value: 'original', label: 'wb.scan.original' },
  { value: 'enhance', label: 'wb.scan.enhance' },
  { value: 'clean', label: 'wb.scan.clean' },
  { value: 'bw', label: 'wb.scan.bw' },
];

type Page = { source: WorkFile; rotate: number; look: Look; view: WorkFile };

// Scans are kept this size: sharp enough to read and print, small to upload.
const MAX_SIDE = 2200;

export default function ScanScreen() {
  const engine = useEngine();
  const { t } = useLanguage();
  const [pages, setPages] = useState<Page[]>([]);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<WorkFile | null>(null);
  const [problem, setProblem] = useState<ProblemValue | null>(null);

  const draw = async (source: WorkFile, rotate: number, look: Look) => {
    const turned = await editImage(source, { rotate, maxSide: MAX_SIDE }, 'jpg', 0.9);
    if (look === 'original') return turned;
    return engine.filterImage(turned, look);
  };

  const add = async (from: 'camera' | 'library') => {
    setProblem(null);
    // Android lets the person crop right after taking the photo.
    try {
      const picked = await pickImages(from, from === 'library', from === 'camera' && Platform.OS === 'android');
      if (!picked.length) return;
      setBusy(t('wb.scan.cleaning'));
      const added: Page[] = [];
      for (const image of picked) {
        const source = await imageFromPicked(image);
        added.push({ source, rotate: 0, look: 'clean', view: await draw(source, 0, 'clean') });
      }
      setCurrent(pages.length);
      setPages((list) => [...list, ...added]);
      setResult(null);
    } catch (error) {
      setProblem(explainError(error, 'scan', t));
    } finally {
      setBusy(null);
    }
  };

  const change = async (update: Partial<Pick<Page, 'rotate' | 'look'>>) => {
    const page = pages[current];
    if (!page) return;
    const next = { ...page, ...update };
    setBusy(t('wb.scan.updating'));
    try {
      const view = await draw(next.source, next.rotate, next.look);
      setPages((list) => list.map((p, i) => (i === current ? { ...next, view } : p)));
      setResult(null);
    } catch (error) {
      setProblem(explainError(error, 'scan', t, [page.source]));
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
    setBusy(t('wb.scan.saving'));
    setProblem(null);
    try {
      if (as === 'jpg') setResult({ ...pages[0].view, name: renamed('scan.jpg', '', 'jpg') });
      else setResult(await joinFiles(pages.map((p) => p.view), 'scan.pdf'));
    } catch (error) {
      setProblem(explainError(error, 'scan', t));
    } finally {
      setBusy(null);
    }
  };

  const page = pages[current];

  return (
    <Screen>
      <SubHeader title={t('wb.scan.title')} />
      <Text style={ui.intro}>
        {t('wb.scan.intro')}
        {Platform.OS === 'android' ? t('wb.scan.cropNote') : ''}
      </Text>
      <PickButtons onPick={add} busy={!!busy} libraryLabel={pages.length ? t('wb.scan.addPage') : t('wb.choosePhoto')} />

      {page && (
        <View style={styles.editor}>
          <Image source={{ uri: fileUri(page.view) }} style={[styles.preview, { aspectRatio: (page.view.width ?? 3) / (page.view.height ?? 4) }]} resizeMode="contain" />
          <View style={styles.tools}>
            <Pressable accessibilityLabel={t('wb.scan.turnLeft')} onPress={() => change({ rotate: (page.rotate + 270) % 360 })} style={styles.tool}>
              <Ionicons name="arrow-undo" size={20} color={Colors.primary} />
            </Pressable>
            <Pressable accessibilityLabel={t('wb.scan.turnRight')} onPress={() => change({ rotate: (page.rotate + 90) % 360 })} style={styles.tool}>
              <Ionicons name="arrow-redo" size={20} color={Colors.primary} />
            </Pressable>
            <Pressable accessibilityLabel={t('wb.scan.removePage')} onPress={remove} style={styles.tool}>
              <Ionicons name="trash" size={20} color="#DC2626" />
            </Pressable>
          </View>
          <View style={styles.looks}>
            {LOOKS.map((look) => (
              <Pressable key={look.value} onPress={() => change({ look: look.value })} style={[styles.look, page.look === look.value && styles.lookActive]}>
                <Text style={[styles.lookText, page.look === look.value && styles.lookTextActive]}>{t(look.label)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {pages.length > 1 && (
        <ScrollView horizontal contentContainerStyle={styles.strip} showsHorizontalScrollIndicator={false}>
          {pages.map((p, i) => (
            <Pressable key={i} onPress={() => setCurrent(i)} style={[styles.stripItem, i === current && styles.stripActive]} accessibilityLabel={t('wb.pageN', { n: i + 1 })}>
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
          <Button label={pages.length === 1 ? t('wb.scan.savePdfOne') : t('wb.scan.savePdf', { n: pages.length })} icon="document" onPress={() => finish('pdf')} disabled={!!busy} />
          {pages.length === 1 && <Button label={t('wb.scan.saveJpg')} icon="image" variant="secondary" onPress={() => finish('jpg')} disabled={!!busy} />}
        </View>
      )}
      {result && <ResultCard file={result} checks={checksFor(result, {}, t)} />}
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
