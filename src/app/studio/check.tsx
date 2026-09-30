import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { PickButtons } from '@/components/pick-buttons';
import { Screen } from '@/components/screen';
import { SubHeader } from '@/components/sub-header';
import { useEngine } from '@/components/workbench/engine';
import { PhotoCheckCard } from '@/components/workbench/photo-check';
import { FileRow, Problem, type ProblemValue, ResultCard, workbenchStyles as ui, Working } from '@/components/workbench/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { findPreset, generalPresets, officialPresets, type Preset } from '@/data/presets';
import { fileById } from '@/lib/chat-files';
import { useLanguage, type Translate } from '@/lib/i18n';
import { explainError } from '@/lib/workbench/explain';
import { pickImages } from '@/lib/images';
import { formatSize, pickFiles, type WorkFile } from '@/lib/workbench/files';
import { imageFromPicked } from '@/lib/workbench/image';
import { checkAgainst, fixToRule, typesLabel, type RuleCheck } from '@/lib/workbench/validate';

function ruleSummary(t: Translate, preset: Preset) {
  const parts = [typesLabel(preset.types)];
  if (preset.width && preset.height) parts.push(`${preset.width} × ${preset.height} px`);
  if (preset.minWidth) parts.push(t('wb.check.atLeast', { n: preset.minWidth }));
  if (preset.maxKB) parts.push(t('wb.check.upTo', { size: formatSize(preset.maxKB * 1024) }));
  if (preset.maxPages) parts.push(preset.maxPages === 1 ? t('wb.check.upToOnePage') : t('wb.check.upToPages', { n: preset.maxPages }));
  return parts.join(' · ');
}

function longDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CheckScreen() {
  const engine = useEngine();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ rule?: string; file?: string }>();
  const [preset, setPreset] = useState<Preset>(findPreset(params.rule) ?? officialPresets[0] ?? generalPresets[0]);
  const [file, setFile] = useState<WorkFile | null>(null);
  const [checks, setChecks] = useState<RuleCheck[]>([]);
  const [fixed, setFixed] = useState<{ file: WorkFile; checks: RuleCheck[]; notes: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<ProblemValue | null>(null);

  const load = async (next: WorkFile, rule = preset) => {
    setFile(next);
    setFixed(null);
    setProblem(null);
    try {
      setChecks(await checkAgainst(next, rule));
    } catch (error) {
      setChecks([]);
      setProblem(explainError(error, 'check', t, [next]));
    }
  };

  const chooseRule = (next: Preset) => {
    setPreset(next);
    if (file) load(file, next);
  };

  // Opened with a file, e.g. "Fix for upload" in the Locker.
  useEffect(() => {
    const given = params.file ? fileById(params.file) : undefined;
    if (given) load(given);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.file]);

  const pickDocument = async () => {
    setProblem(null);
    try {
      const [picked] = await pickFiles({ pdf: true, images: true });
      if (picked) load(picked);
    } catch (error) {
      setProblem(explainError(error, 'openPdf', t));
    }
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    setProblem(null);
    try {
      const [picked] = await pickImages(source);
      if (picked) load(await imageFromPicked(picked));
    } catch (error) {
      setProblem(explainError(error, 'openPhoto', t));
    }
  };

  const fix = async () => {
    if (!file) return;
    setBusy(t('wb.check.fixing'));
    setProblem(null);
    try {
      const result = await fixToRule(file, preset, engine);
      setFixed({ ...result, checks: await checkAgainst(result.file, preset) });
    } catch (error) {
      setProblem(explainError(error, 'check', t, [file]));
    } finally {
      setBusy(null);
    }
  };

  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  const wantsPhoto = !preset.types.includes('pdf');

  return (
    <Screen>
      <SubHeader title={t('wb.check.title')} />
      <Text style={ui.intro}>{t('wb.check.intro')}</Text>

      {officialPresets.length > 0 && <RuleGroup title={t('wb.check.official')} presets={officialPresets} selected={preset} onSelect={chooseRule} />}
      <RuleGroup title={t('wb.check.common')} presets={generalPresets} selected={preset} onSelect={chooseRule} />

      <View style={styles.rule}>
        <Text style={styles.ruleTitle}>{preset.title}</Text>
        <Text style={styles.ruleWhere}>{preset.where}</Text>
        <Text style={styles.ruleLine}>{ruleSummary(t, preset)}</Text>
        {preset.note && <Text style={styles.ruleWhere}>{preset.note}</Text>}
        {preset.source ? (
          <Pressable onPress={() => Linking.openURL(preset.source!.url)} style={styles.source} accessibilityRole="link">
            <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
            <Text style={styles.sourceText}>
              {preset.source.label}
              {preset.lastChecked ? t('wb.check.lastChecked', { date: longDate(preset.lastChecked) }) : ''}
            </Text>
            <Ionicons name="open-outline" size={14} color={Colors.primary} />
          </Pressable>
        ) : (
          <Text style={styles.ruleWhere}>{t('wb.check.commonNote')}</Text>
        )}
      </View>

      {wantsPhoto ? (
        <PickButtons onPick={pickPhoto} busy={!!busy} libraryLabel={t('wb.choosePhoto')} />
      ) : (
        <View style={ui.row}>
          <Button label={file ? t('wb.chooseAnotherFile') : t('wb.chooseFile')} icon="document-attach" variant={file ? 'secondary' : 'primary'} onPress={pickDocument} />
        </View>
      )}

      {file && (
        <View style={[styles.yours, allOk ? styles.yoursOk : styles.yoursBad]}>
          <FileRow file={file} />
          {checks.map((check) => (
            <View key={check.label} style={styles.check}>
              <Ionicons name={check.ok ? 'checkmark-circle' : 'close-circle'} size={18} color={check.ok ? Colors.success : '#DC2626'} />
              <Text style={styles.checkText}>{check.label}</Text>
            </View>
          ))}
          {allOk ? (
            <Text style={styles.okText}>{t('wb.check.meets')}</Text>
          ) : (
            checks.length > 0 && (
              <View style={ui.row}>
                <Button label={t('wb.check.fix')} icon="construct" onPress={fix} busy={!!busy} />
              </View>
            )
          )}
        </View>
      )}
      {busy && <Working text={busy} />}
      {problem && <Problem text={problem} />}
      {fixed && <ResultCard file={fixed.file} before={file ?? undefined} checks={fixed.checks} note={fixed.notes.join(' ') || undefined} title={t('wb.check.meetsTitle')} />}
      {preset.photo && (fixed?.file ?? file)?.kind === 'image' && <PhotoCheckCard key={(fixed?.file ?? file)!.name} file={(fixed?.file ?? file)!} checks={preset.photo} />}
    </Screen>
  );
}

function RuleGroup({ title, presets, selected, onSelect }: { title: string; presets: Preset[]; selected: Preset; onSelect: (p: Preset) => void }) {
  return (
    <View style={styles.group}>
      <Text style={ui.label}>{title}</Text>
      <View style={styles.chips}>
        {presets.map((preset) => {
          const active = preset.id === selected.id;
          return (
            <Pressable key={preset.id} onPress={() => onSelect(preset)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{preset.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text },
  chipTextActive: { color: Colors.onDark, fontWeight: '600' },
  rule: { gap: 4, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg },
  ruleTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  ruleWhere: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  ruleLine: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  sourceText: { flexShrink: 1, fontSize: 13, color: Colors.text },
  yours: { gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
  yoursOk: { borderColor: Colors.success },
  yoursBad: { borderColor: '#DC2626' },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkText: { fontSize: 15, color: Colors.text },
  okText: { fontSize: 14, fontWeight: '600', color: Colors.success },
});
