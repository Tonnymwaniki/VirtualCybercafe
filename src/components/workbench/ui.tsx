import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useRouter, type Href } from 'expo-router';

import { Button } from '@/components/button';
import { ErrorCard } from '@/components/error-card';
import { UseInApplication } from '@/components/jobs/use-in-application';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { translate, useLanguage, type Translate } from '@/lib/i18n';
import { keepFile } from '@/lib/chat-files';
import { GUEST_ID } from '@/lib/profile-store';
import { LockerFullError } from '@/lib/locker-store';
import type { Explained } from '@/lib/workbench/explain';
import { fileUri, formatSize, saveToLocker, shareFile, size, type WorkFile } from '@/lib/workbench/files';

// Shared pieces of the Workbench screens: the file being worked on, size
// limits, progress and the result card with its checks.

export type Check = { ok: boolean; label: string };

const english: Translate = (key, vars) => translate('en', key, vars);

// "1 page" / "3 pages" in the chosen language.
export function pagesLabel(t: Translate, n: number) {
  return n === 1 ? t('wb.onePage') : t('wb.pages', { n });
}

// "1 file ready" / "3 files ready".
export function filesReadyLabel(t: Translate, n: number) {
  return n === 1 ? t('wb.oneFileReady') : t('wb.filesReady', { n });
}

// What the result card ticks: every tick is measured on the real file.
// Labels are in English unless a `t` is passed.
export function checksFor(
  file: WorkFile,
  rule: { maxBytes?: number; width?: number; height?: number } = {},
  t: Translate = english,
): Check[] {
  const checks: Check[] = [];
  const bytes = size(file);
  checks.push(
    rule.maxBytes
      ? { ok: bytes <= rule.maxBytes, label: t('wb.sizeWithLimit', { size: formatSize(bytes), limit: formatSize(rule.maxBytes) }) }
      : { ok: true, label: formatSize(bytes) },
  );
  checks.push({ ok: true, label: file.kind === 'pdf' ? 'PDF' : file.mimeType === 'image/png' ? 'PNG' : 'JPG' });
  if (file.kind === 'pdf' && file.pages != null) checks.push({ ok: true, label: pagesLabel(t, file.pages) });
  if (file.kind === 'image' && file.width && file.height) {
    const exact = rule.width && rule.height;
    checks.push({
      ok: !exact || (file.width === rule.width && file.height === rule.height),
      label:
        exact && (file.width !== rule.width || file.height !== rule.height)
          ? t('wb.dimsNeeds', { w: file.width, h: file.height, nw: rule.width!, nh: rule.height! })
          : t('wb.dims', { w: file.width, h: file.height }),
    });
  }
  return checks;
}

export function Thumb({ file, size: side = 56 }: { file: WorkFile; size?: number }) {
  if (file.kind === 'image') {
    return <Image source={{ uri: fileUri(file) }} style={[styles.thumb, { width: side, height: side }]} resizeMode="cover" />;
  }
  return (
    <View style={[styles.thumb, styles.pdfThumb, { width: side, height: side }]}>
      <Ionicons name="document-text" size={side * 0.45} color="#DC2626" />
      <Text style={styles.pdfLabel}>PDF</Text>
    </View>
  );
}

// The file the tool is working on, with a way to remove or swap it.
export function FileRow({ file, onRemove, children }: { file: WorkFile; onRemove?: () => void; children?: React.ReactNode }) {
  const { t } = useLanguage();
  const details = [formatSize(size(file))];
  if (file.kind === 'pdf' && file.pages != null) details.push(pagesLabel(t, file.pages));
  if (file.kind === 'image' && file.width) details.push(`${file.width} × ${file.height}`);
  return (
    <View style={styles.fileRow}>
      <Thumb file={file} size={44} />
      <View style={styles.fileText}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={styles.fileMeta}>{details.join(' · ')}</Text>
      </View>
      {children}
      {onRemove && (
        <Pressable accessibilityLabel={t('wb.remove', { name: file.name })} hitSlop={8} onPress={onRemove}>
          <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const SIZE_CHOICES = [100, 200, 500, 1024, 2048];

export function sizeLabel(kb: number) {
  return kb >= 1024 ? `${+(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// Common upload limits, plus "Other" to type one in.
export function SizeLimit({ value, onChange, choices = SIZE_CHOICES }: { value: number; onChange: (kb: number) => void; choices?: number[] }) {
  const [custom, setCustom] = useState(choices.includes(value) ? '' : String(value));
  const [typing, setTyping] = useState(!choices.includes(value));
  const { t } = useLanguage();
  return (
    <View style={styles.limits}>
      <Text style={styles.label}>{t('wb.sizeLimit')}</Text>
      <View style={styles.chips}>
        {choices.map((kb) => {
          const active = !typing && kb === value;
          return (
            <Pressable
              key={kb}
              onPress={() => {
                setTyping(false);
                onChange(kb);
              }}
              style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{sizeLabel(kb)}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setTyping(true)} style={[styles.chip, typing && styles.chipActive]}>
          <Text style={[styles.chipText, typing && styles.chipTextActive]}>{t('wb.other')}</Text>
        </Pressable>
      </View>
      {typing && (
        <View style={styles.customRow}>
          <TextInput
            value={custom}
            onChangeText={(text) => {
              const digits = text.replace(/[^\d]/g, '').slice(0, 6);
              setCustom(digits);
              if (Number(digits) >= 10) onChange(Number(digits));
            }}
            keyboardType="number-pad"
            placeholder={t('wb.otherPlaceholder')}
            placeholderTextColor={Colors.textMuted}
            style={styles.customInput}
          />
          <Text style={styles.fileMeta}>KB</Text>
        </View>
      )}
    </View>
  );
}

export function Working({ text }: { text: string }) {
  return (
    <View style={styles.working}>
      <ActivityIndicator color={Colors.primary} />
      <Text style={styles.fileMeta}>{text}</Text>
    </View>
  );
}

// A problem on a tool screen: a short line for a simple fix (a wrong
// number), or a full explanation card for an error (see explain.ts).
export type ProblemValue = string | Explained;

export function Problem({ text, onRetry }: { text: ProblemValue; onRetry?: () => void }) {
  if (typeof text !== 'string') return <ErrorCard error={text} onRetry={onRetry} />;
  return <Text style={styles.problem}>{text}</Text>;
}

function SaveButtons({ file, compact }: { file: WorkFile; compact?: boolean }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [full, setFull] = useState<string | null>(null);
  const toLocker = async () => {
    setState('saving');
    try {
      await saveToLocker(user?.id ?? GUEST_ID, file);
      setState('saved');
    } catch (error) {
      setFull(error instanceof LockerFullError ? error.message : null);
      setState('failed');
    }
  };
  if (compact) {
    return (
      <View style={styles.compactButtons}>
        <Pressable accessibilityLabel={t('wb.saveA11y', { name: file.name })} hitSlop={6} onPress={() => shareFile(file)} style={styles.iconButton}>
          <Ionicons name="download-outline" size={20} color={Colors.primary} />
        </Pressable>
        <Pressable accessibilityLabel={t('wb.saveToLockerA11y', { name: file.name })} hitSlop={6} onPress={toLocker} disabled={state === 'saving' || state === 'saved'} style={styles.iconButton}>
          <Ionicons
            name={state === 'saved' ? 'checkmark-circle' : 'cloud-upload-outline'}
            size={20}
            color={state === 'saved' ? Colors.success : state === 'failed' ? '#DC2626' : Colors.primary}
          />
        </Pressable>
      </View>
    );
  }
  return (
    <>
      <View style={styles.buttons}>
        <Button label={t('wb.download')} icon="download" onPress={() => shareFile(file)} />
        <Button
          label={state === 'saved' ? t('wb.inLocker') : t('wb.saveToLocker')}
          icon={state === 'saved' ? 'checkmark-circle' : 'cloud-upload'}
          variant="secondary"
          onPress={toLocker}
          busy={state === 'saving'}
          disabled={state === 'saved'}
        />
      </View>
      {state === 'failed' && <Problem text={full ?? t('wb.saveFailed')} />}
    </>
  );
}

// Opens Print at any cyber with this file.
function PrintByCode({ file }: { file: WorkFile }) {
  const router = useRouter();
  const { t } = useLanguage();
  return (
    <Pressable onPress={() => router.push(`/studio/print?file=${keepFile(file).id}` as Href)} style={({ pressed }) => [styles.moreLink, pressed && { opacity: 0.6 }]}>
      <Ionicons name="qr-code-outline" size={16} color={Colors.primary} />
      <Text style={styles.moreText}>{t('wb.printAnyCyber')}</Text>
    </Pressable>
  );
}

// The finished file: what was measured, and what to do with it.
type Retry = { smaller?: () => void; clearer?: () => void };

export function ResultCard({ file, checks, note, title, before, retry }: {
  file: WorkFile;
  checks: Check[];
  note?: string;
  title?: string;
  // The file it was made from, shown beside the result so the change is clear.
  before?: WorkFile;
  // "Try smaller" / "Try clearer" when the result isn't what the person wanted.
  retry?: Retry;
}) {
  const { t } = useLanguage();
  const allOk = checks.every((c) => c.ok);
  return (
    <View style={[styles.result, !allOk && styles.resultWarn]}>
      <View style={styles.resultHead}>
        <Thumb file={file} size={64} />
        <View style={styles.fileText}>
          <Text style={[styles.resultTitle, !allOk && styles.warnText]}>{allOk ? (title ?? t('wb.ready')) : t('wb.notQuite')}</Text>
          <Text style={styles.fileName} numberOfLines={2}>
            {file.name}
          </Text>
        </View>
      </View>
      <View style={styles.checks}>
        {checks.map((check) => (
          <View key={check.label} style={styles.check}>
            <Ionicons name={check.ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={check.ok ? Colors.success : '#DC2626'} />
            <Text style={styles.checkText}>{check.label}</Text>
          </View>
        ))}
      </View>
      {before && <BeforeAfter before={before} after={file} />}
      {note && <Text style={styles.note}>{note}</Text>}
      {retry && (retry.smaller || retry.clearer) && (
        <View style={styles.retryRow}>
          {retry.smaller && (
            <Pressable onPress={retry.smaller} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.6 }]}>
              <Ionicons name="contract-outline" size={15} color={Colors.primary} />
              <Text style={styles.retryText}>{t('wb.trySmaller')}</Text>
            </Pressable>
          )}
          {retry.clearer && (
            <Pressable onPress={retry.clearer} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.6 }]}>
              <Ionicons name="sparkles-outline" size={15} color={Colors.primary} />
              <Text style={styles.retryText}>{t('wb.tryClearer')}</Text>
            </Pressable>
          )}
        </View>
      )}
      <SaveButtons file={file} />
      <View style={styles.more}>
        <UseInApplication file={file} />
        <PrintByCode file={file} />
      </View>
    </View>
  );
}

function describe(t: Translate, file: WorkFile) {
  const parts = [formatSize(size(file))];
  if (file.kind === 'image' && file.width) parts.push(`${file.width} × ${file.height}`);
  if (file.kind === 'pdf' && file.pages != null) parts.push(pagesLabel(t, file.pages));
  return parts.join(' · ');
}

// "7.4 MB → 798 KB, 89% smaller" with both pictures side by side.
export function BeforeAfter({ before, after }: { before: WorkFile; after: WorkFile }) {
  const { t } = useLanguage();
  const from = size(before);
  const to = size(after);
  const change = from > 0 ? Math.round(((from - to) / from) * 100) : 0;
  return (
    <View style={styles.compare}>
      <View style={styles.compareSide}>
        <Thumb file={before} size={96} />
        <Text style={styles.compareLabel}>{t('wb.before')}</Text>
        <Text style={styles.compareMeta}>{describe(t, before)}</Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color={Colors.textMuted} />
      <View style={styles.compareSide}>
        <Thumb file={after} size={96} />
        <Text style={styles.compareLabel}>{t('wb.after')}</Text>
        <Text style={styles.compareMeta}>{describe(t, after)}</Text>
      </View>
      {change !== 0 && (
        <Text style={[styles.compareChange, change < 0 && { color: Colors.textMuted }]}>
          {change > 0 ? t('wb.smaller', { n: change }) : t('wb.bigger', { n: -change })}
        </Text>
      )}
    </View>
  );
}

// Several finished files, such as split pages or pictures of pages.
export function ResultList({ files, title }: { files: WorkFile[]; title: string }) {
  return (
    <View style={styles.result}>
      <Text style={styles.resultTitle}>{title}</Text>
      {files.map((file) => (
        <FileRow key={file.name} file={file}>
          <SaveButtons file={file} compact />
        </FileRow>
      ))}
    </View>
  );
}

export function Toggle({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.toggle}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.toggleItem, active && styles.toggleActive]}>
            <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Files in the order they will be joined, with buttons to move or remove each.
export function OrderList({ files, onChange }: { files: WorkFile[]; onChange: (files: WorkFile[]) => void }) {
  const move = (from: number, to: number) => {
    const next = [...files];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const { t } = useLanguage();
  return (
    <View style={styles.order}>
      {files.map((file, index) => (
        <FileRow key={`${index}-${file.name}`} file={file} onRemove={() => onChange(files.filter((_, i) => i !== index))}>
          <Text style={styles.position}>{index + 1}</Text>
          <Pressable accessibilityLabel={t('wb.moveUp')} hitSlop={6} disabled={index === 0} onPress={() => move(index, index - 1)}>
            <Ionicons name="arrow-up" size={20} color={index === 0 ? Colors.border : Colors.primary} />
          </Pressable>
          <Pressable accessibilityLabel={t('wb.moveDown')} hitSlop={6} disabled={index === files.length - 1} onPress={() => move(index, index + 1)}>
            <Ionicons name="arrow-down" size={20} color={index === files.length - 1 ? Colors.border : Colors.primary} />
          </Pressable>
        </FileRow>
      ))}
    </View>
  );
}

export const workbenchStyles = StyleSheet.create({
  intro: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text },
  row: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
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

const styles = StyleSheet.create({
  compare: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  compareSide: { alignItems: 'center', gap: 2 },
  compareLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginTop: 4 },
  compareMeta: { fontSize: 12, color: Colors.text },
  compareChange: { width: '100%', textAlign: 'center', fontSize: 14, fontWeight: '700', color: Colors.success },
  retryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  retryText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  thumb: { borderRadius: Radius.sm, backgroundColor: Colors.background },
  pdfThumb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  pdfLabel: { fontSize: 9, fontWeight: '800', color: '#DC2626' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  fileText: { flex: 1, gap: 2 },
  fileName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  fileMeta: { fontSize: 13, color: Colors.textMuted },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text },
  limits: { gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 14, color: Colors.text },
  chipTextActive: { color: Colors.onDark, fontWeight: '600' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  customInput: {
    width: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    color: Colors.text,
  },
  working: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  problem: { color: '#DC2626', fontSize: 14, lineHeight: 20 },
  result: {
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.success,
    padding: Spacing.lg,
  },
  resultWarn: { borderColor: '#DC2626' },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  more: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: Spacing.lg, rowGap: Spacing.xs },
  moreLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  moreText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  resultTitle: { fontSize: 16, fontWeight: '800', color: Colors.success },
  warnText: { color: '#DC2626' },
  checks: { gap: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkText: { fontSize: 15, color: Colors.text },
  note: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  buttons: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  compactButtons: { flexDirection: 'row', gap: Spacing.xs },
  iconButton: { padding: 6 },
  order: { gap: Spacing.sm },
  position: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  toggle: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 3 },
  toggleItem: { flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, alignItems: 'center' },
  toggleActive: { backgroundColor: Colors.primary },
  toggleText: { fontSize: 13, color: Colors.text, textAlign: 'center' },
  toggleTextActive: { color: Colors.onDark, fontWeight: '600' },
});
