import { File } from 'expo-file-system';
import { Linking, Platform } from 'react-native';

import type { LockerCategory } from '@/data/locker';
import { LOCKER_BUCKET, supabase } from '@/lib/supabase';

export const lockerCategories: LockerCategory[] = ['Documents', 'Photos', 'Certificates'];

export type StoredFile = {
  // Storage path: <userId>/<category>/<timestamp>-<name>
  path: string;
  name: string;
  category: LockerCategory;
  bytes: number | null;
  createdAt: string;
  mimeType: string;
  // Demo mode only: where the picked file lives on this device.
  localUri?: string;
};

export type UploadInput = {
  uri: string;
  name: string;
  mimeType: string;
  bytes: number | null;
  category: LockerCategory;
};

// Demo mode keeps uploads in memory for this session only.
const demoFiles: StoredFile[] = [];

function displayName(storedName: string) {
  return storedName.replace(/^\d+-/, '');
}

function safeName(name: string) {
  return name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'file';
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

export async function listFiles(userId: string): Promise<StoredFile[]> {
  if (!supabase) return demoFiles.filter((f) => f.path.startsWith(`${userId}/`));
  const client = supabase;
  const perCategory = await Promise.all(
    lockerCategories.map(async (category) => {
      const { data, error } = await client.storage
        .from(LOCKER_BUCKET)
        .list(`${userId}/${category}`, { sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      return (data ?? [])
        .filter((item) => item.id)
        .map<StoredFile>((item) => ({
          path: `${userId}/${category}/${item.name}`,
          name: displayName(item.name),
          category,
          bytes: typeof item.metadata?.size === 'number' ? item.metadata.size : null,
          createdAt: item.created_at ?? new Date().toISOString(),
          mimeType: item.metadata?.mimetype ?? 'application/octet-stream',
        }));
    }),
  );
  return perCategory.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function uploadFile(userId: string, input: UploadInput): Promise<void> {
  const path = `${userId}/${input.category}/${Date.now()}-${safeName(input.name)}`;
  if (!supabase) {
    demoFiles.unshift({
      path,
      name: input.name,
      category: input.category,
      bytes: input.bytes,
      createdAt: new Date().toISOString(),
      mimeType: input.mimeType,
      localUri: input.uri,
    });
    return;
  }
  const body = await readBytes(input.uri);
  const { error } = await supabase.storage
    .from(LOCKER_BUCKET)
    .upload(path, body, { contentType: input.mimeType, upsert: false });
  if (error) throw error;
}

export async function deleteFile(file: StoredFile): Promise<void> {
  if (!supabase) {
    const index = demoFiles.findIndex((f) => f.path === file.path);
    if (index >= 0) demoFiles.splice(index, 1);
    return;
  }
  const { error } = await supabase.storage.from(LOCKER_BUCKET).remove([file.path]);
  if (error) throw error;
}

// Opens the file with a short-lived private link.
export async function openFile(file: StoredFile): Promise<void> {
  let url = file.localUri;
  if (supabase) {
    const { data, error } = await supabase.storage.from(LOCKER_BUCKET).createSignedUrl(file.path, 120);
    if (error) throw error;
    url = data.signedUrl;
  }
  if (!url) return;
  if (Platform.OS === 'web') window.open(url, '_blank');
  else await Linking.openURL(url);
}
