// The files in open chats, kept in memory on the phone while the app runs.
// Saved chats keep only their descriptions (FileMeta), so a file made
// earlier needs to be saved (Download or Locker) to keep it.

import type { FileMeta } from '@/lib/chat-types';
import { newId } from '@/lib/record-store';
import type { WorkFile } from '@/lib/workbench/files';

const files = new Map<string, WorkFile>();

export function keepFile(file: WorkFile): FileMeta {
  const id = `f${newId()}`;
  files.set(id, file);
  return metaOf(id, file);
}

export function metaOf(id: string, file: WorkFile): FileMeta {
  return {
    id,
    name: file.name,
    kind: file.kind,
    bytes: file.bytes.byteLength,
    ...(file.pages != null ? { pages: file.pages } : {}),
    ...(file.width ? { width: file.width, height: file.height } : {}),
  };
}

export function fileById(id: string) {
  return files.get(id);
}
