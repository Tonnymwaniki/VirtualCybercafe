import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { checksFor, FileRow, Problem, ResultCard, Toggle, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { pickImages } from '@/lib/images';
import type { WorkFile } from '@/lib/workbench/files';
import { editImage, imageFromPicked, imageSize, shrinkImage, type ImageFormat } from '@/lib/workbench/image';

type Mode = 'exact' | 'fit';

const PRESETS = [
  { label: '600 × 600', width: 600, height: 600, mode: 'exact' as Mode },
  { label: '413 × 531 (35 × 45 mm)', width: 413, height: 531, mode: 'exact' as Mode },
  { label: 'Long side 1600', width: 1600, height: 1600, mode: 'fit' as Mode },
  { label: 'Long side 1024', width: 1024, height: 1024, mode: 'fit' as Mode },
];

export default function ResizeScreen() {
  const [original, setOriginal] = useState<WorkFile | null>(null);
  const [width, setWidth] = useState('600');
  const [height, setHeight] = useState('600');
  const [mode, setMode] = useState<Mode>('exact');
  const [format, setFormat] = useState<ImageFormat>('jpg');
  const [maxKb, setMaxKb] = useState('');
  const [result, setResult] = useState<WorkFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    const [picked] = await pickImages(source);
    if (!picked) return;
    const file = await imageFromPicked(picked);
    await imageSize(file);
    setOriginal(file);
    setResult(null);
  };

  const w = Number(width);
  const h = Number(height);
  const limit = Number(maxKb) > 0 ? Number(maxKb) * 1024 : undefined;

  const resize = async () => {
    if (!original) return;
    if (!(w >= 16 && w <= 8000 && h >= 16 && h <= 8000)) {
      setProblem('Width and height must be between 16 and 8000 pixels.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const edit = mode === 'exact' ? { exact: { width: w, height: h } } : { maxSide: Math.max(w, h) };
      let out: WorkFile;
      if (limit && format === 'jpg') {
        out = (await shrinkImage(original, limit, mode === 'exact' ? { exact: { width: w, height: h } } : { maxSide: Math.max(w, h) })).file;
      } else {
        out = await editImage(original, edit, format);
      }
      setResult(out);
    } catch {
      setProblem('That photo couldn’t be resized. Try another one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SubHeader title="Resize a photo" />
      <Text style={ui.intro}>Set the exact size a form asks for, or make a big photo smaller in pixels.</Text>
      <PickButtons onPick={pick} busy={busy} />
      {original && <FileRow file={original} />}

      <Text style={ui.label}>Quick sizes</Text>
      <View style={styles.chips}>
        {PRESETS.map((preset) => (
          <Pressable
            key={preset.label}
            onPress={() => {
              setWidth(String(preset.width));
              setHeight(String(preset.height));
              setMode(preset.mode);
            }}
            style={styles.chip}>
            <Text style={styles.chipText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sizeRow}>
        <Field label="Width (px)" value={width} onChange={setWidth} />
        <Text style={styles.times}>×</Text>
        <Field label="Height (px)" value={height} onChange={setHeight} />
      </View>

      <Toggle
        options={[
          { value: 'exact', label: 'Exact size (crops the edges)' },
          { value: 'fit', label: 'Keep the whole photo' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as Mode)}
      />
      <Toggle
        options={[
          { value: 'jpg', label: 'JPG' },
          { value: 'png', label: 'PNG' },
        ]}
        value={format}
        onChange={(v) => setFormat(v as ImageFormat)}
      />
      {format === 'jpg' && <Field label="Size limit in KB (optional)" value={maxKb} onChange={setMaxKb} />}

      <View style={ui.row}>
        <Button label="Resize" icon="resize" onPress={resize} busy={busy} disabled={!original} />
      </View>
      {busy && <Working text="Resizing…" />}
      {problem && <Problem text={problem} />}
      {result && (
        <ResultCard
          file={result}
          before={original ?? undefined}
          checks={checksFor(result, { maxBytes: format === 'jpg' ? limit : undefined, ...(mode === 'exact' ? { width: w, height: h } : {}) })}
          note={mode === 'fit' ? 'The whole photo is kept, so one side may be shorter than you typed.' : undefined}
        />
      )}
    </Screen>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^\d]/g, '').slice(0, 5))}
        keyboardType="number-pad"
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, backgroundColor: Colors.primarySoft, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  sizeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  times: { fontSize: 18, color: Colors.textMuted, paddingBottom: 10 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 13, color: Colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    color: Colors.text,
  },
});
