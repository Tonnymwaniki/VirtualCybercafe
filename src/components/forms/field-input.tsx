import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLanguage, type TextKey } from '@/lib/i18n';
import type { FieldResult } from '@/lib/forms/reason';
import { sizeText } from '@/lib/forms/reason';
import { isFileField, type FormField, type FormFile, type Source } from '@/lib/forms/schema';

type Props = {
  field: FormField;
  value: string;
  result?: FieldResult;
  // Where the value came from, when it wasn't typed here.
  source?: Source | 'typed';
  file?: FormFile;
  onChange: (value: string) => void;
  onPickFile?: () => void;
  onRemoveFile?: () => void;
  highlight?: boolean;
  // The document slot, for file and image fields.
  document?: ReactNode;
};

const sourceKey: Record<Source, TextKey> = {
  profile: 'forms.fromProfile',
  id_card: 'forms.fromId',
  cv: 'forms.fromCv',
  job: 'forms.fromJob',
};

const keyboard = { phone: 'phone-pad', email: 'email-address', number: 'numeric' } as const;

// One field of a reasoning form: the input, why the real form asks for it,
// where the value came from, and what is wrong with it in plain words.
export function FieldInput({ field, value, result, source, file, onChange, onPickFile, onRemoveFile, highlight, document }: Props) {
  const { t } = useLanguage();
  const [showWhy, setShowWhy] = useState(false);
  const bad = result?.status === 'invalid' || (highlight && result?.status === 'missing');
  const good = result?.status === 'ok' && (value.trim() || file);

  return (
    <View style={[styles.field, highlight && styles.highlight]}>
      <View style={styles.labelRow}>
        {good ? (
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
        ) : bad ? (
          <Ionicons name="alert-circle" size={16} color="#DC2626" />
        ) : (
          <Ionicons name="ellipse-outline" size={16} color={Colors.textMuted} />
        )}
        <Text style={styles.label}>
          {field.label}
          {!field.required && <Text style={styles.optional}> {t('forms.optional')}</Text>}
        </Text>
        {!!field.why && (
          <Pressable onPress={() => setShowWhy((v) => !v)} hitSlop={8} accessibilityLabel={t('forms.why')}>
            <Ionicons name={showWhy ? 'help-circle' : 'help-circle-outline'} size={20} color={Colors.primary} />
          </Pressable>
        )}
      </View>
      {showWhy && !!field.why && <Text style={styles.why}>{field.why}</Text>}
      {!!field.help && <Text style={styles.help}>{field.help}</Text>}

      {isFileField(field) && document ? (
        document
      ) : isFileField(field) ? (
        file ? (
          <View style={styles.fileRow}>
            <Ionicons name="document-attach" size={20} color={Colors.primary} />
            <View style={styles.fileText}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.fileMeta}>{sizeText(file.bytes)}</Text>
            </View>
            <Pressable onPress={onPickFile} hitSlop={6}>
              <Text style={styles.link}>{t('forms.change')}</Text>
            </Pressable>
            <Pressable onPress={onRemoveFile} hitSlop={6} accessibilityLabel={t('forms.remove')}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onPickFile} style={({ pressed }) => [styles.attach, pressed && styles.dim]}>
            <Ionicons name="add-circle" size={18} color={Colors.primary} />
            <Text style={styles.link}>{t('forms.attach')}</Text>
            {!!field.document?.types.length && <Text style={styles.fileMeta}>{field.document.types.map((x) => x.toUpperCase()).join(', ')}</Text>}
          </Pressable>
        )
      ) : field.type === 'radio' || field.type === 'select' ? (
        <View style={styles.options}>
          {field.options?.map((option) => {
            const on = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onChange(on && !field.required ? '' : option.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.option, on && styles.optionOn]}>
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : field.type === 'checkbox' ? (
        <Pressable onPress={() => onChange(value === 'yes' ? '' : 'yes')} accessibilityRole="checkbox" accessibilityState={{ checked: value === 'yes' }} style={styles.checkRow}>
          <Ionicons name={value === 'yes' ? 'checkbox' : 'square-outline'} size={22} color={value === 'yes' ? Colors.primary : Colors.textMuted} />
          <Text style={styles.checkText}>{t('forms.iConfirm')}</Text>
        </Pressable>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={field.placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboard[field.type as keyof typeof keyboard] ?? 'default'}
          autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
          multiline={field.type === 'textarea'}
          style={[styles.input, field.type === 'textarea' && styles.multiline, bad && styles.inputBad]}
        />
      )}

      {source && source !== 'typed' && !!value && <Text style={styles.source}>{t(sourceKey[source])}</Text>}
      {bad && !!result?.message && !(isFileField(field) && document && file) && <Text style={styles.error}>{result.message}</Text>}
      {!!result?.warning && (
        <View style={styles.warning}>
          <Ionicons name="warning" size={16} color={Colors.warning} />
          <Text style={styles.warningText}>{result.warning}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  highlight: { backgroundColor: '#FFF7ED', paddingHorizontal: Spacing.sm, marginHorizontal: -Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  optional: { fontWeight: '400', color: Colors.textMuted, fontSize: 13 },
  why: { fontSize: 13, lineHeight: 19, color: Colors.navy, backgroundColor: Colors.primarySoft, padding: Spacing.sm, borderRadius: Radius.sm },
  help: { fontSize: 13, lineHeight: 18, color: Colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.card,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  inputBad: { borderColor: '#DC2626' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  option: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.card },
  optionOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionText: { fontSize: 14, color: Colors.text },
  optionTextOn: { color: Colors.onDark, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkText: { flex: 1, fontSize: 14, color: Colors.text },
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.sm, backgroundColor: Colors.card },
  fileText: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  fileMeta: { fontSize: 12, color: Colors.textMuted },
  link: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  source: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
  error: { fontSize: 13, lineHeight: 18, color: '#B91C1C' },
  warning: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: '#FFFBEB', padding: Spacing.sm, borderRadius: Radius.sm },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#92400E' },
  dim: { opacity: 0.6 },
});
