import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/button';
import { IconBadge } from '@/components/icon-badge';
import { FilePanel } from '@/components/locker/file-panel';
import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { guessCategory, lockerFilters, lockerLabels, type LockerCategory } from '@/data/locker';
import { useAuth } from '@/lib/auth';
import { formatBytes, pickImages } from '@/lib/images';
import { LOCKER_LIMIT_BYTES, LockerFullError, listFiles, previewLinks, uploadFile, type StoredFile } from '@/lib/locker-store';

type Filter = (typeof lockerFilters)[number];

const categoryStyle: Record<LockerCategory, { icon: ComponentProps<typeof Ionicons>['name']; color: string }> = {
  CV: { icon: 'briefcase', color: '#6366F1' },
  ID: { icon: 'card', color: '#0EA5E9' },
  Documents: { icon: 'document-text', color: '#3B82F6' },
  Photos: { icon: 'image', color: '#F59E0B' },
  Certificates: { icon: 'ribbon', color: '#EAB308' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LockerScreen() {
  const router = useRouter();
  const { user, loading, demoMode, signOut } = useAuth();
  const [filter, setFilter] = useState<Filter>('All');
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [openPath, setOpenPath] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return setFiles([]);
    try {
      const list = await listFiles(user.id);
      setFiles(list);
      setPreviews(await previewLinks(list));
    } catch {
      setError('Could not load your files. Check your connection and try again.');
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const add = async (kind: 'photo' | 'document') => {
    if (!user) return;
    setError(null);
    // Files go where the filter points; with "All", the name suggests a folder
    // (a file called "My CV.pdf" goes to CV & letters).
    const folder = (name: string, mimeType: string): LockerCategory => (filter !== 'All' ? filter : guessCategory(name, mimeType));
    try {
      if (kind === 'photo') {
        const [image] = await pickImages('library');
        if (!image) return;
        setBusy(true);
        const name = image.fileName ?? `photo-${new Date().toISOString().slice(0, 10)}.jpg`;
        await uploadFile(user.id, { uri: image.uri, name, mimeType: 'image/jpeg', bytes: image.bytes, category: folder(name, 'image/jpeg') });
      } else {
        const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        if (result.canceled) return;
        const asset = result.assets[0];
        setBusy(true);
        const mimeType = asset.mimeType ?? 'application/octet-stream';
        await uploadFile(user.id, { uri: asset.uri, name: asset.name, mimeType, bytes: asset.size ?? null, category: folder(asset.name, mimeType) });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof LockerFullError ? e.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const changed = async () => {
    setOpenPath(null);
    await refresh();
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader title="My Digital Locker" />
        <ActivityIndicator color={Colors.primary} />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <AppHeader title="My Digital Locker" />
        <View style={styles.signedOut}>
          <IconBadge icon="lock-closed" color={Colors.navy} size={64} />
          <Text style={styles.signedOutTitle}>Keep your documents safe</Text>
          <Text style={styles.signedOutText}>
            Store your ID, certificates, CV and photos in one private place, ready whenever a service
            needs them. Only you can see them.
          </Text>
          <View style={styles.row}>
            <Button label="Sign in with phone" icon="call" onPress={() => router.push('/sign-in')} />
          </View>
        </View>
      </Screen>
    );
  }

  const shown = filter === 'All' ? files : files.filter((file) => file.category === filter);

  return (
    <Screen>
      <AppHeader title="My Digital Locker" />

      <View style={styles.account}>
        <View style={styles.accountText}>
          <Text style={styles.accountName}>{user.fullName ?? 'Your account'}</Text>
          <Text style={styles.accountPhone}>
            {user.phone}
            {demoMode ? ' · demo mode' : ''}
          </Text>
        </View>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/profile')} style={({ pressed }) => [styles.detailsLink, pressed && styles.pressed]}>
        <Ionicons name="person-circle" size={22} color={Colors.primary} />
        <View style={styles.accountText}>
          <Text style={styles.detailsTitle}>My Details</Text>
          <Text style={styles.accountPhone}>ID, contacts, family and education. Every form fills itself from these.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </Pressable>

      <View style={styles.secureNote}>
        <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
        <Text style={styles.secureText}>
          {demoMode
            ? 'Demo mode: files are kept on this device for now.'
            : 'Your files are private. Only you can open them.'}
        </Text>
      </View>

      <UsageBar used={files.reduce((sum, f) => sum + (f.bytes ?? 0), 0)} />

      <View style={styles.filters}>
        {lockerFilters.map((option) => {
          const active = option === filter;
          return (
            <Pressable
              key={option}
              onPress={() => setFilter(option)}
              style={[styles.filter, active && styles.filterActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {option === 'All' ? 'All' : lockerLabels[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <Button label="Add photo" icon="image" variant="secondary" onPress={() => add('photo')} disabled={busy} />
        <Button label="Add file" icon="cloud-upload" onPress={() => add('document')} busy={busy} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}

      {shown.length === 0 ? (
        <Text style={styles.empty}>
          {filter === 'All' ? 'Your Locker is empty. Add your first document.' : `Nothing in ${lockerLabels[filter]} yet.`}
        </Text>
      ) : (
        <View style={styles.list}>
          {shown.map((file, index) => {
            const expanded = openPath === file.path;
            const preview = previews[file.path];
            return (
              <View key={file.path} style={[styles.fileItem, index === shown.length - 1 && styles.lastRow]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setOpenPath(expanded ? null : file.path)}
                  style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}>
                  {preview ? (
                    <Image source={{ uri: preview }} style={styles.thumb} accessibilityIgnoresInvertColors />
                  ) : (
                    <IconBadge icon={categoryStyle[file.category].icon} color={categoryStyle[file.category].color} size={40} />
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.rowDetail}>
                      {lockerLabels[file.category]} · {formatBytes(file.bytes)} · {formatDate(file.createdAt)}
                    </Text>
                  </View>
                  <Ionicons name={expanded ? 'chevron-up' : 'ellipsis-horizontal'} size={20} color={Colors.textMuted} />
                </Pressable>
                {expanded && <FilePanel file={file} preview={preview} onChanged={changed} />}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

// How full the Locker is, with a warning from 80%.
function UsageBar({ used }: { used: number }) {
  const share = Math.min(1, used / LOCKER_LIMIT_BYTES);
  const warn = share >= 0.8;
  return (
    <View style={styles.usage}>
      <View style={styles.usageTrack}>
        <View style={[styles.usageFill, { width: `${Math.max(share * 100, 1)}%` }, warn && styles.usageWarn]} />
      </View>
      <Text style={[styles.usageText, warn && styles.usageWarnText]}>
        {formatBytes(used)} of 200 MB used
        {warn ? '. Almost full: delete old files or shrink big ones in the Document Workbench.' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  usage: { gap: 6 },
  usageTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  usageFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  usageWarn: { backgroundColor: Colors.warning },
  usageText: { fontSize: 12, color: Colors.textMuted },
  usageWarnText: { color: Colors.warning, fontWeight: '600' },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  detailsTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  pressed: { opacity: 0.7 },
  signedOut: {
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  signedOutTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  signedOutText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  accountText: { flex: 1 },
  accountName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  accountPhone: { fontSize: 13, color: Colors.textMuted },
  signOut: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#EAF7EF',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  secureText: { flex: 1, fontSize: 13, color: Colors.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  filter: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, color: Colors.text },
  filterTextActive: { color: Colors.onDark, fontWeight: '600' },
  row: { flexDirection: 'row', gap: Spacing.md, alignSelf: 'stretch' },
  error: { color: '#DC2626', fontSize: 14 },
  empty: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.xl },
  list: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fileItem: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  thumb: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.background },
  lastRow: { borderBottomWidth: 0 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowDetail: { fontSize: 12, color: Colors.textMuted },
});
