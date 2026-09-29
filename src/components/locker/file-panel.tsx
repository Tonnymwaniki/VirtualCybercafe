import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { UseInApplication } from '@/components/jobs/use-in-application';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { lockerCategories, lockerLabel, type LockerCategory } from '@/data/locker';
import { keepFile } from '@/lib/chat-files';
import { useLanguage } from '@/lib/i18n';
import { relinkJobDocument } from '@/lib/jobs-store';
import { deleteFile, moveFile, openFile, renameFile, type StoredFile } from '@/lib/locker-store';
import { lockerWorkFile } from '@/lib/workbench/files';

type Mode = 'actions' | 'rename' | 'move' | 'delete';

type Props = {
  file: StoredFile;
  preview?: string;
  // Called after a rename, move or delete, so the list reloads.
  onChanged: () => void;
};

// What can be done with one Locker file: the same buttons as a Workbench
// result, plus rename, move to another folder and delete.
export function FilePanel({ file, preview, onChanged }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>('actions');
  const [name, setName] = useState(file.name.replace(/\.[a-z0-9]{2,5}$/i, ''));
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // `id` names the button that shows the spinner while the action runs.
  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    setProblem(null);
    try {
      await action();
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : t('locker.actionFailed'));
    } finally {
      setBusy(null);
    }
  };

  const userId = file.path.slice(0, file.path.indexOf('/'));
  const rename = () =>
    run('Save', async () => {
      const path = await renameFile(file, name);
      await relinkJobDocument(userId, file.path, path, path.slice(path.lastIndexOf('/') + 1).replace(/^\d+-/, '')).catch(() => {});
      onChanged();
    });

  // Loads the file for the Workbench and opens a screen with it.
  const openWith = (id: string, screen: string) =>
    run(id, async () => {
      const work = await lockerWorkFile(file);
      if (!work) throw new Error(t('locker.onlyPdfPhotos'));
      router.push(`${screen}?file=${keepFile(work).id}` as Href);
    });

  const actions: { id: string; label: string; icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void }[] = [
    { id: 'Open', label: t('common.open'), icon: 'open-outline', onPress: () => run('Open', () => openFile(file)) },
    { id: 'Print', label: t('wb.printAnyCyber'), icon: 'qr-code-outline', onPress: () => openWith('Print', '/studio/print') },
    { id: 'Fix', label: t('locker.fixForUpload'), icon: 'construct-outline', onPress: () => openWith('Fix', '/studio/check') },
    { id: 'Rename', label: t('locker.rename'), icon: 'create-outline', onPress: () => setMode('rename') },
    { id: 'Move', label: t('locker.move'), icon: 'folder-open-outline', onPress: () => setMode('move') },
    { id: 'Delete', label: t('locker.delete'), icon: 'trash-outline', onPress: () => setMode('delete') },
  ];

  return (
    <View style={styles.panel}>
      {preview && <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" accessibilityLabel={file.name} />}

      {mode === 'actions' && (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              disabled={!!busy}
              style={({ pressed }) => [styles.action, action.id === 'Delete' && styles.danger, pressed && styles.pressed]}>
              {busy === action.id ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name={action.icon} size={16} color={action.id === 'Delete' ? '#DC2626' : Colors.primary} />
              )}
              <Text style={[styles.actionText, action.id === 'Delete' && styles.dangerText]}>{action.label}</Text>
            </Pressable>
          ))}
          <UseInApplication file={file} lockerPath={file.path} />
        </View>
      )}

      {mode === 'rename' && (
        <View style={styles.form}>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            style={styles.input}
            placeholder={t('locker.newName')}
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={() => name.trim() && rename()}
          />
          <View style={styles.row}>
            <SmallButton label={t('common.cancel')} onPress={() => setMode('actions')} />
            <SmallButton
              label={t('common.save')}
              primary
              busy={busy === 'Save'}
              disabled={!name.trim()}
              onPress={rename}
            />
          </View>
        </View>
      )}

      {mode === 'move' && (
        <View style={styles.form}>
          <Text style={styles.label}>{t('locker.moveTo')}</Text>
          <View style={styles.actions}>
            {lockerCategories
              .filter((category) => category !== file.category)
              .map((category: LockerCategory) => (
                <Pressable
                  key={category}
                  disabled={!!busy}
                  onPress={() => run(category, async () => {
                    const path = await moveFile(file, category);
                    await relinkJobDocument(userId, file.path, path, file.name).catch(() => {});
                    onChanged();
                  })}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                  {busy === category && <ActivityIndicator size="small" color={Colors.primary} />}
                  <Text style={styles.actionText}>{lockerLabel(t, category)}</Text>
                </Pressable>
              ))}
          </View>
          <SmallButton label={t('common.cancel')} onPress={() => setMode('actions')} />
        </View>
      )}

      {mode === 'delete' && (
        <View style={styles.form}>
          <Text style={styles.label}>{t('locker.deleteConfirm', { name: file.name })}</Text>
          <View style={styles.row}>
            <SmallButton label={t('locker.keepIt')} onPress={() => setMode('actions')} />
            <SmallButton
              label={t('locker.delete')}
              danger
              busy={busy === 'Delete'}
              onPress={() => run('Delete', async () => {
                await deleteFile(file);
                onChanged();
              })}
            />
          </View>
        </View>
      )}

      {problem && <Text style={styles.problem}>{problem}</Text>}
    </View>
  );
}

function SmallButton({ label, onPress, primary, danger, busy, disabled }: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  const filled = primary || danger;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        styles.small,
        primary && styles.smallPrimary,
        danger && styles.smallDanger,
        (pressed || disabled) && styles.pressed,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={filled ? Colors.onDark : Colors.primary} />
      ) : (
        <Text style={[styles.smallText, filled && { color: Colors.onDark }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.md, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  preview: { width: '100%', height: 200, borderRadius: Radius.md, backgroundColor: Colors.background },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  actionText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  danger: { backgroundColor: '#FEE2E2' },
  dangerText: { color: '#DC2626' },
  pressed: { opacity: 0.6 },
  form: { gap: Spacing.sm },
  label: { fontSize: 14, color: Colors.text },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    color: Colors.text,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  small: {
    minWidth: 90,
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  smallPrimary: { backgroundColor: Colors.primary },
  smallDanger: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  smallText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  problem: { color: '#DC2626', fontSize: 13 },
});
