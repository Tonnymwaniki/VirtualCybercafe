import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorCard } from '@/components/error-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { documentProblems, typeName } from '@/lib/forms/documents';
import { sizeText } from '@/lib/forms/reason';
import type { DocType, FormField, FormFile } from '@/lib/forms/schema';
import { useLanguage } from '@/lib/i18n';
import type { Explained } from '@/lib/workbench/explain';

// Size limits people see on job portals. None of the portals we checked
// publish one, so the person picks what their site says.
const LIMITS = [0, 500, 1024, 2048, 5120];

// "JPG, 2.6 MB", so a type change shows even when the size barely moved.
const describe = (type: DocType | undefined, bytes: number) => (type ? `${typeName(type)}, ${sizeText(bytes)}` : sizeText(bytes));

type Props = {
  field: FormField;
  file?: FormFile;
  limitKB?: number;
  fixing: boolean;
  fixProblem?: Explained | null;
  onPick: () => void;
  onRemove: () => void;
  onFix: () => void;
  onLimit: (kb: number) => void;
};

// A document slot in a form: the file, what was measured on it, what is
// wrong in plain words (required vs yours), and Fix automatically.
export function DocumentField({ field, file, limitKB, fixing, fixProblem, onPick, onRemove, onFix, onLimit }: Props) {
  const { t } = useLanguage();
  const problems = file ? documentProblems(field, file, limitKB) : [];
  const facts = file?.facts;
  const measured = facts
    ? [
        typeName(facts.type),
        sizeText(facts.bytes),
        facts.pages ? t(facts.pages === 1 ? 'forms.onePage' : 'forms.pages', { n: facts.pages }) : '',
        facts.width && facts.height ? `${facts.width} × ${facts.height}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : file
      ? sizeText(file.bytes)
      : '';

  return (
    <View style={styles.wrap}>
      {file ? (
        <View style={[styles.fileRow, problems.length ? styles.fileBad : !!facts && styles.fileGood]}>
          <Ionicons name={file.mimeType.startsWith('image/') ? 'image' : 'document-text'} size={22} color={problems.length ? '#DC2626' : Colors.primary} />
          <View style={styles.fileText}>
            <Text style={styles.fileName} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={styles.meta}>{measured}</Text>
          </View>
          <Pressable onPress={onPick} hitSlop={6}>
            <Text style={styles.link}>{t('forms.change')}</Text>
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={6} accessibilityLabel={t('forms.remove')}>
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onPick} style={({ pressed }) => [styles.attach, pressed && styles.dim]}>
          <Ionicons name="add-circle" size={18} color={Colors.primary} />
          <Text style={styles.link}>{t('forms.attach')}</Text>
          {!!field.document?.types.length && <Text style={styles.meta}>{field.document.types.map((x) => x.toUpperCase()).join(', ')}</Text>}
        </Pressable>
      )}

      {file?.fixedFrom && !problems.length && (
        <View style={styles.fixed}>
          <Text style={styles.fixedLine}>
            {t('forms.original')}: <Text style={styles.strong}>{describe(file.fixedFrom.type, file.fixedFrom.bytes)}</Text>
            {'   →   '}
            {t('forms.new')}: <Text style={styles.strong}>{describe(facts?.type, file.bytes)}</Text>
          </Text>
          <View style={styles.readyRow}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.ready}>{t('forms.docReady')}</Text>
          </View>
          {file.notes?.map((note) => (
            <Text key={note} style={styles.meta}>
              {note}
            </Text>
          ))}
        </View>
      )}

      {problems.map((problem) => (
        <View key={problem.what} style={styles.problem}>
          <View style={styles.problemHead}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.problemText}>{problem.what}</Text>
          </View>
          <View style={styles.compare}>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>{t('forms.required')}</Text>
              <Text style={styles.cellValue}>{problem.required}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>{t('forms.yourFile')}</Text>
              <Text style={[styles.cellValue, styles.bad]}>{problem.yours}</Text>
            </View>
          </View>
          {!problem.fixable && <Text style={styles.meta}>{t('forms.cantFix')}</Text>}
        </View>
      ))}

      {problems.some((p) => p.fixable) && (
        <Pressable onPress={onFix} disabled={fixing} style={({ pressed }) => [styles.fix, (pressed || fixing) && styles.dim]}>
          {fixing ? <ActivityIndicator color={Colors.onDark} /> : <Ionicons name="color-wand" size={18} color={Colors.onDark} />}
          <Text style={styles.fixText}>{fixing ? t('forms.fixing') : t('forms.fixAuto')}</Text>
        </Pressable>
      )}
      {fixProblem && <ErrorCard error={fixProblem} onRetry={onFix} />}

      <View style={styles.limits}>
        <Text style={styles.meta}>{t('forms.siteLimit')}</Text>
        {LIMITS.map((kb) => {
          const on = (limitKB ?? 0) === kb;
          return (
            <Pressable key={kb} onPress={() => onLimit(kb)} style={[styles.limit, on && styles.limitOn]}>
              <Text style={[styles.limitText, on && styles.limitTextOn]}>{kb ? sizeText(kb * 1024).replace('.0 ', ' ') : t('forms.noLimit')}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.primary, borderRadius: Radius.sm, padding: Spacing.md },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.sm, backgroundColor: Colors.card },
  fileBad: { borderColor: '#FCA5A5' },
  fileGood: { borderColor: '#86EFAC' },
  fileText: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 12, lineHeight: 17, color: Colors.textMuted },
  link: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  problem: { backgroundColor: '#FEF2F2', borderRadius: Radius.sm, padding: Spacing.md, gap: Spacing.sm },
  problemHead: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  problemText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#7F1D1D', lineHeight: 19 },
  compare: { flexDirection: 'row', gap: Spacing.sm },
  cell: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.sm, padding: Spacing.sm, gap: 2 },
  cellLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  cellValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  bad: { color: '#B91C1C' },
  fix: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12 },
  fixText: { fontSize: 15, fontWeight: '700', color: Colors.onDark },
  fixed: { backgroundColor: '#F0FDF4', borderRadius: Radius.sm, padding: Spacing.md, gap: 4 },
  fixedLine: { fontSize: 14, color: Colors.text },
  strong: { fontWeight: '700' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ready: { fontSize: 14, fontWeight: '700', color: Colors.success },
  limits: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  limit: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.card },
  limitOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  limitText: { fontSize: 12, color: Colors.text },
  limitTextOn: { color: Colors.onDark, fontWeight: '600' },
  dim: { opacity: 0.6 },
});
