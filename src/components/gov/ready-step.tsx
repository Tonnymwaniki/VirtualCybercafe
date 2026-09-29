import * as DocumentPicker from 'expo-document-picker';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CheckRow, LinkButton, Note } from '@/components/gov/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { GovTask, Requirement } from '@/data/gov-tasks';
import type { AppUser } from '@/lib/auth';
import { listFiles, uploadFile, type StoredFile } from '@/lib/locker-store';

type Props = {
  task: GovTask;
  user: AppUser | null;
  ready: string[];
  onToggle: (requirementId: string) => void;
};

function extension(name: string, mimeType: string) {
  const fromName = /\.(\w{2,4})$/.exec(name)?.[1];
  if (fromName) return fromName.toLowerCase();
  return mimeType === 'application/pdf' ? 'pdf' : 'jpg';
}

// Step 2: ticks off what the user already has, looking in their Locker for
// documents saved under the requirement's name.
export function ReadyStep({ task, user, ready, onToggle }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setFiles(await listFiles(user.id));
    } catch {
      setError('Couldn’t open your Locker. You can still tick items yourself.');
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const inLocker = (requirement: Requirement) =>
    !!requirement.lockerName && files.find((file) => file.name.startsWith(requirement.lockerName!));

  const upload = async (requirement: Requirement) => {
    if (!user || !requirement.lockerName) return;
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    setUploading(requirement.id);
    try {
      await uploadFile(user.id, {
        uri: asset.uri,
        name: `${requirement.lockerName}.${extension(asset.name, mimeType)}`,
        mimeType,
        bytes: asset.size ?? null,
        category: requirement.lockerCategory ?? 'Documents',
      });
      await refresh();
      if (!ready.includes(requirement.id)) onToggle(requirement.id);
    } catch {
      setError('The upload didn’t go through. Check your connection and try again.');
    } finally {
      setUploading(null);
    }
  };

  const doneCount = task.requirements.filter((r) => ready.includes(r.id) || inLocker(r)).length;

  return (
    <>
      <Card title={`Ready: ${doneCount} of ${task.requirements.length}`}>
        {task.requirements.map((requirement) => {
          const file = inLocker(requirement);
          return (
            <CheckRow
              key={requirement.id}
              label={requirement.label}
              detail={file ? `In your Locker: ${file.name}` : undefined}
              checked={!!file || ready.includes(requirement.id)}
              onToggle={file ? undefined : () => onToggle(requirement.id)}>
              {!file && (requirement.lockerName || requirement.fix) && (
                <View style={styles.actions}>
                  {requirement.lockerName && user && (
                    <LinkButton
                      icon="cloud-upload"
                      label={uploading === requirement.id ? 'Uploading...' : 'Add to Locker'}
                      onPress={() => upload(requirement)}
                    />
                  )}
                  {requirement.fix && (
                    <LinkButton
                      icon="arrow-forward-circle"
                      label={requirement.fix.label}
                      onPress={() => router.push(requirement.fix!.route as Href)}
                    />
                  )}
                </View>
              )}
            </CheckRow>
          );
        })}
      </Card>

      {error && <Note tone="warn">{error}</Note>}
      {!user ? (
        <View style={styles.signIn}>
          <Text style={styles.muted}>Sign in to keep these documents in your private Locker and find them here next time.</Text>
          <Button label="Sign in" variant="secondary" onPress={() => router.push('/sign-in')} />
        </View>
      ) : (
        doneCount === task.requirements.length && <Note tone="good">You have everything. Go to Your details next.</Note>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginLeft: 36 },
  signIn: { gap: Spacing.md },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
});
