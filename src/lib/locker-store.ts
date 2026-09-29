import { File } from 'expo-file-system';
import { Linking, Platform } from 'react-native';

import { lockerCategories, type LockerCategory } from '@/data/locker';
import { LOCKER_BUCKET, supabase } from '@/lib/supabase';

export { lockerCategories };

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

export async function readBytes(uri: string): Promise<ArrayBuffer> {
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

// Each person's Locker holds up to 200 MB (supabase/migrations/0005_locker_quota.sql).
export const LOCKER_LIMIT_BYTES = 200 * 1024 * 1024;

export class LockerFullError extends Error {}

// Bytes used in the person's Locker, or null if it can't be told.
export async function lockerBytesUsed(userId: string): Promise<number | null> {
  if (!supabase) return demoFiles.filter((f) => f.path.startsWith(`${userId}/`)).reduce((sum, f) => sum + (f.bytes ?? 0), 0);
  const { data, error } = await supabase.rpc('locker_bytes_used');
  return error || typeof data !== 'number' ? null : data;
}

// Returns the new file's storage path.
export async function uploadFile(userId: string, input: UploadInput): Promise<string> {
  const path = `${userId}/${input.category}/${Date.now()}-${safeName(input.name)}`;
  const used = await lockerBytesUsed(userId);
  if (used !== null && used + (input.bytes ?? 0) > LOCKER_LIMIT_BYTES) {
    throw new LockerFullError('Your Locker is full (200 MB). Delete files you no longer need, or shrink big PDFs and photos in the Document Workbench.');
  }
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
    return path;
  }
  const body = await readBytes(input.uri);
  const { error } = await supabase.storage
    .from(LOCKER_BUCKET)
    .upload(path, body, { contentType: input.mimeType, upsert: false });
  if (error) throw error;
  return path;
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

function storedName(path: string) {
  return path.slice(path.lastIndexOf('/') + 1);
}

// Renames a file, keeping its folder and upload time. Returns the new path.
export async function renameFile(file: StoredFile, name: string): Promise<string> {
  const clean = safeName(name.trim());
  const extension = /\.[a-z0-9]{2,5}$/i.exec(file.name)?.[0] ?? '';
  const withExtension = extension && !clean.toLowerCase().endsWith(extension.toLowerCase()) ? clean + extension : clean;
  const stamp = /^(\d+)-/.exec(storedName(file.path))?.[1] ?? String(Date.now());
  return moveTo(file, `${file.path.slice(0, file.path.lastIndexOf('/'))}/${stamp}-${withExtension}`);
}

// Moves a file to another folder. Returns the new path.
export async function moveFile(file: StoredFile, category: LockerCategory): Promise<string> {
  const userId = file.path.slice(0, file.path.indexOf('/'));
  return moveTo(file, `${userId}/${category}/${storedName(file.path)}`);
}

async function moveTo(file: StoredFile, path: string): Promise<string> {
  if (path === file.path) return path;
  if (!supabase) {
    const demo = demoFiles.find((f) => f.path === file.path);
    if (demo) {
      demo.path = path;
      demo.name = displayName(storedName(path));
      demo.category = path.split('/')[1] as LockerCategory;
    }
    return path;
  }
  const { error } = await supabase.storage.from(LOCKER_BUCKET).move(file.path, path);
  if (error) throw error;
  return path;
}

// Private links to show photos as thumbnails, by path. Links last an hour.
export async function previewLinks(files: StoredFile[]): Promise<Record<string, string>> {
  const images = files.filter((f) => f.mimeType.startsWith('image/'));
  if (!images.length) return {};
  if (!supabase) return Object.fromEntries(images.filter((f) => f.localUri).map((f) => [f.path, f.localUri!]));
  const { data, error } = await supabase.storage.from(LOCKER_BUCKET).createSignedUrls(images.map((f) => f.path), 3600);
  if (error) return {};
  const links: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) links[item.path] = item.signedUrl;
  return links;
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

function base64FromBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// Downloads a Locker file's bytes, e.g. to send it to a print shop.
export async function fileBytes(file: StoredFile): Promise<ArrayBuffer> {
  let url = file.localUri;
  if (supabase) {
    const { data, error } = await supabase.storage.from(LOCKER_BUCKET).createSignedUrl(file.path, 120);
    if (error) throw error;
    url = data.signedUrl;
  }
  if (!url) throw new Error('File not found');
  return (await fetch(url)).arrayBuffer();
}

// Downloads a Locker file as a data: URL, e.g. to put a certificate photo
// into an application pack PDF.
export async function fileDataUrl(file: StoredFile): Promise<string> {
  return `data:${file.mimeType};base64,${base64FromBytes(await fileBytes(file))}`;
}
