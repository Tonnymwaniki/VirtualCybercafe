import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorCard } from '@/components/error-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { LockerCategory } from '@/data/locker';
import { useLanguage } from '@/lib/i18n';
import { listFiles, type StoredFile } from '@/lib/locker-store';
import { sizeText } from '@/lib/forms/reason';
import type { FormField, FormFile } from '@/lib/forms/schema';
import { explainError, type Explained } from '@/lib/workbench/explain';
import { pickFiles, saveToLocker } from '@/lib/workbench/files';

type Props = {
  field: FormField | null;
  userId: string;
  // Guests can attach from the phone, but only signed-in people have a Locker.
  hasLocker: boolean;
  onPicked: (file: FormFile) => void;
  onClose: () => void;
};

// Attach a document to a form: from the Locker, or from the phone (then kept
// in the Locker too, so the next application can reuse it).
export function FilePicker({ field, userId, hasLocker, onPicked, onClose }: Props) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Explained | null>(null);

  useEffect(() => {
    if (!field) return;
    setProblem(null);
    if (!hasLocker) return setFiles([]);
    setFiles(null);
    listFiles(userId)
      .then((list) => {
        const category = field.document?.lockerCategory;
        // The field's own folder first.
        setFiles([...list].sort((a, b) => Number(b.category === category) - Number(a.category === category)));
      })
      .catch(() => setFiles([]));
  }, [field, userId, hasLocker]);

  const fromPhone = async () => {
    if (!field) return;
    setBusy(true);
    setProblem(null);
    try {
      const [file] = await pickFiles({ pdf: true, images: true });
      if (!file) return;
      let path = `device:${file.name}`;
      if (hasLocker) path = await saveToLocker(userId, file, field.document?.lockerCategory as LockerCategory | undefined);
      onPicked({ path, name: file.name, mimeType: file.mimeType, bytes: file.bytes.byteLength });
    } catch (error) {
      setProblem(explainError(error, 'locker', t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!field} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>{field?.label}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t('common.cancel')}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
        </View>
        <Button label={t('forms.fromPhone')} icon="phone-portrait" onPress={fromPhone} busy={busy} />
        {problem && <ErrorCard error={problem} />}
        {hasLocker && <Text style={styles.section}>{t('forms.fromLocker')}</Text>}
        {files === null ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <ScrollView style={styles.list}>
            {hasLocker && !files.length && <Text style={styles.muted}>{t('forms.lockerEmpty')}</Text>}
            {!hasLocker && <Text style={styles.muted}>{t('forms.signInLocker')}</Text>}
            {files.map((file) => (
              <Pressable
                key={file.path}
                onPress={() => onPicked({ path: file.path, name: file.name, mimeType: file.mimeType, bytes: file.bytes ?? 0 })}
                style={({ pressed }) => [styles.row, pressed && styles.dim]}>
                <Ionicons name={file.mimeType.startsWith('image/') ? 'image' : 'document-text'} size={20} color={Colors.primary} />
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.muted}>
                    {file.category} · {file.bytes ? sizeText(file.bytes) : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
  section: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  rowText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted },
  dim: { opacity: 0.6 },
});
