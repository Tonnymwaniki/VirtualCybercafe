import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { useEngine } from '@/components/workbench/engine';
import { checksFor, FileRow, Problem, ResultCard, ResultList, Toggle, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fileUri, pickFiles, type WorkFile } from '@/lib/workbench/files';
import { keepPages, pageCount, parsePages, splitPages, WorkbenchError } from '@/lib/workbench/pdf';

type Mode = 'keep' | 'remove' | 'each';

// Page numbers as someone would type them: 1-3, 5
function describe(indexes: number[]) {
  const sorted = [...indexes].sort((a, b) => a - b).map((i) => i + 1);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : `${sorted[i]}`);
    i = j;
  }
  return parts.join(', ');
}

export default function SplitScreen() {
  const engine = useEngine();
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [thumbs, setThumbs] = useState<WorkFile[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [typed, setTyped] = useState('');
  const [mode, setMode] = useState<Mode>('keep');
  const [result, setResult] = useState<WorkFile | null>(null);
  const [parts, setParts] = useState<WorkFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const total = original?.pages ?? 0;

  const choose = async () => {
    setProblem(null);
    try {
      const [file] = await pickFiles({ pdf: true });
      if (!file) return;
      await pageCount(file);
      setOriginal(file);
      setSelected([]);
      setTyped('');
      setResult(null);
      setParts([]);
      setThumbs([]);
      // Small pictures of the pages; the numbers still work without them.
      const shown: WorkFile[] = [];
      engine
        .renderPdf(file, { scale: 1, maxSide: 260, quality: 0.6, pages: Array.from({ length: Math.min(file.pages ?? 0, 40) }, (_, i) => i) }, (page) => {
          shown.push(page);
          setThumbs([...shown]);
        })
        .catch(() => {});
    } catch (error) {
      setProblem(error instanceof WorkbenchError ? error.message : 'That PDF couldn’t be opened. Try another one.');
    }
  };

  const toggle = (index: number) => {
    const next = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index].sort((a, b) => a - b);
    setSelected(next);
    setTyped(describe(next));
    setResult(null);
  };

  const typePages = (text: string) => {
    setTyped(text);
    setResult(null);
    const parsed = parsePages(text, total);
    if (Array.isArray(parsed)) setSelected([...parsed].sort((a, b) => a - b));
  };

  const run = async () => {
    if (!original) return;
    setProblem(null);
    setResult(null);
    setParts([]);
    if (mode !== 'each') {
      const parsed = parsePages(typed, total);
      if (typeof parsed === 'string') {
        setProblem(parsed);
        return;
      }
      const keep = mode === 'keep' ? parsed : Array.from({ length: total }, (_, i) => i).filter((i) => !parsed.includes(i));
      if (!keep.length) {
        setProblem('That would leave no pages.');
        return;
      }
      setBusy(true);
      try {
        setResult(await keepPages(original, keep, mode === 'keep' ? `-pages-${describe(parsed).replace(/[ ,]+/g, '_')}` : '-edited'));
      } catch (error) {
        setProblem(error instanceof WorkbenchError ? error.message : 'That didn’t work. Try again.');
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      setParts(await splitPages(original));
    } catch (error) {
      setProblem(error instanceof WorkbenchError ? error.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SubHeader title="Pick or split pages" />
      <Text style={ui.intro}>Keep only the pages a form needs, remove pages, or split a PDF into one file per page.</Text>
      <View style={ui.row}>
        <Button label={original ? 'Choose another PDF' : 'Choose PDF'} icon="document" variant={original ? 'secondary' : 'primary'} onPress={choose} />
      </View>
      {original && (
        <>
          <FileRow file={original} />
          <Toggle
            options={[
              { value: 'keep', label: 'Keep pages' },
              { value: 'remove', label: 'Remove pages' },
              { value: 'each', label: 'Every page' },
            ]}
            value={mode}
            onChange={(value) => {
              setMode(value as Mode);
              setResult(null);
              setParts([]);
            }}
          />
          {mode !== 'each' && (
            <>
              <Text style={ui.label}>{mode === 'keep' ? 'Pages to keep' : 'Pages to remove'}: tap them or type</Text>
              <TextInput value={typed} onChangeText={typePages} placeholder="e.g. 1-3, 5" style={ui.input} accessibilityLabel="Pages" />
              <View style={styles.grid}>
                {Array.from({ length: total }, (_, index) => {
                  const on = selected.includes(index);
                  const thumb = thumbs.find((t) => t.name.endsWith(`-page-${index + 1}.jpg`));
                  return (
                    <Pressable key={index} onPress={() => toggle(index)} style={[styles.page, on && (mode === 'keep' ? styles.keep : styles.remove)]} accessibilityLabel={`Page ${index + 1}`}>
                      {thumb ? <Image source={{ uri: fileUri(thumb) }} style={styles.thumb} resizeMode="contain" /> : <View style={styles.thumb} />}
                      <View style={styles.pageFoot}>
                        {on && <Ionicons name={mode === 'keep' ? 'checkmark-circle' : 'close-circle'} size={14} color={mode === 'keep' ? Colors.success : '#DC2626'} />}
                        <Text style={styles.pageNumber}>{index + 1}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          <View style={ui.row}>
            <Button
              label={mode === 'each' ? `Split into ${total} files` : mode === 'keep' ? 'Make PDF with these pages' : 'Remove these pages'}
              icon="cut"
              onPress={run}
              busy={busy}
            />
          </View>
        </>
      )}
      {busy && <Working text="Working…" />}
      {problem && <Problem text={problem} />}
      {result && <ResultCard file={result} checks={checksFor(result)} />}
      {parts.length > 0 && <ResultList files={parts} title={`${parts.length} files ready`} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  page: { width: 76, borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.card, padding: 3, gap: 2 },
  keep: { borderColor: Colors.success },
  remove: { borderColor: '#DC2626', opacity: 0.6 },
  thumb: { width: '100%', height: 90, backgroundColor: Colors.background, borderRadius: 4 },
  pageFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  pageNumber: { fontSize: 12, fontWeight: '700', color: Colors.text },
});
