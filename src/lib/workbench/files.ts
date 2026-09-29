// Files moving through the Document Workbench: picking them, keeping their
// bytes, and saving or sharing the results. Everything runs on the phone.

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { guessCategory, type LockerCategory } from '@/data/locker';
import { fileBytes, readBytes, uploadFile, type StoredFile } from '@/lib/locker-store';

export type WorkKind = 'pdf' | 'image';

export type WorkFile = {
  name: string;
  kind: WorkKind;
  mimeType: string;
  bytes: Uint8Array;
  // Somewhere the file can be read from (a file on the phone, or a blob or
  // data URL on the web), made on demand by fileUri().
  uri?: string;
  // Images only.
  width?: number;
  height?: number;
  // PDFs only.
  pages?: number;
};

export const isWeb = Platform.OS === 'web';

export function size(file: WorkFile) {
  return file.bytes.byteLength;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${+(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

export function kindOf(mimeType: string, name: string): WorkKind | null {
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (mimeType.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(name)) return 'image';
  return null;
}

// "passport.jpg" -> "passport-small.jpg"
export function renamed(name: string, suffix: string, extension?: string) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = extension ?? (dot > 0 ? name.slice(dot + 1) : '');
  return `${base}${suffix}${ext ? `.${ext}` : ''}`;
}

const CHUNK = 0x8000;

export function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export function fromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Picks PDFs and/or images from the phone's files.
export async function pickFiles(options: { pdf?: boolean; images?: boolean; multiple?: boolean }): Promise<WorkFile[]> {
  const type = [...(options.pdf !== false ? ['application/pdf'] : []), ...(options.images ? ['image/*'] : [])];
  const result = await DocumentPicker.getDocumentAsync({ type, multiple: !!options.multiple, copyToCacheDirectory: true });
  if (result.canceled) return [];
  const files: WorkFile[] = [];
  for (const asset of result.assets) {
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    const kind = kindOf(mimeType, asset.name);
    if (!kind) continue;
    const bytes = new Uint8Array(await readBytes(asset.uri));
    files.push({ name: asset.name, kind, mimeType: kind === 'pdf' ? 'application/pdf' : mimeType, bytes, uri: asset.uri });
  }
  return files;
}

// A readable address for the file, written to the phone's cache if needed.
export function fileUri(file: WorkFile): string {
  if (file.uri) return file.uri;
  if (isWeb) {
    file.uri = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.mimeType }));
    return file.uri;
  }
  const safe = file.name.replace(/[^\w.\- ]+/g, '_') || 'file';
  const out = new File(Paths.cache, `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safe}`);
  out.write(file.bytes);
  file.uri = out.uri;
  return file.uri;
}

// Downloads (web) or opens the share sheet (phone), where the person can
// save the file, send it on WhatsApp or email it.
export async function shareFile(file: WorkFile) {
  if (isWeb) {
    const link = document.createElement('a');
    link.href = fileUri(file);
    link.download = file.name;
    link.click();
    return;
  }
  const uri = fileUri(file);
  await Sharing.shareAsync(uri, {
    mimeType: file.mimeType,
    UTI: file.kind === 'pdf' ? 'com.adobe.pdf' : file.mimeType === 'image/png' ? 'public.png' : 'public.jpeg',
    dialogTitle: file.name,
  });
}

// Returns the file's path in the Locker.
export async function saveToLocker(userId: string, file: WorkFile, category?: LockerCategory) {
  return uploadFile(userId, {
    uri: fileUri(file),
    name: file.name,
    mimeType: file.mimeType,
    bytes: size(file),
    category: category ?? guessCategory(file.name, file.mimeType),
  });
}

// Loads a Locker file for the Workbench, the chat or a print code. Null for
// a file the Workbench can't work on (only PDFs and photos).
export async function lockerWorkFile(file: StoredFile): Promise<WorkFile | null> {
  const kind = kindOf(file.mimeType, file.name);
  if (!kind) return null;
  const bytes = new Uint8Array(await fileBytes(file));
  return { name: file.name, kind, mimeType: kind === 'pdf' ? 'application/pdf' : file.mimeType, bytes };
}
