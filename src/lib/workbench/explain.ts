// Turns any error from a tool into something a person can act on: what went
// wrong, why it most likely happened, and what to do next. The technical
// message is kept as a small detail line and, for unexpected errors, sent to
// the error reports (stats.ts) so it can be fixed.

import { ApiError } from '@/lib/api';
import type { TextKey } from '@/lib/i18n';
import { LockerFullError } from '@/lib/locker-store';
import { QuickPrintError } from '@/lib/quick-print';
import { reportError } from '@/lib/stats';
import { formatSize, type WorkFile } from '@/lib/workbench/files';
import { WorkbenchError } from '@/lib/workbench/pdf';

export type ErrorTask =
  | 'resize'
  | 'shrinkPhoto'
  | 'shrinkPdf'
  | 'passport'
  | 'scan'
  | 'photosToPdf'
  | 'merge'
  | 'split'
  | 'pdfToJpg'
  | 'check'
  | 'print'
  | 'locker'
  | 'lockerLoad'
  | 'lockerFile'
  | 'openPhoto'
  | 'openPdf'
  | 'photoCheck'
  | 'cvImport'
  | 'idScan'
  | 'jobPack'
  | 'chatFile';

export type ErrorKind =
  | 'heic'
  | 'too_big'
  | 'decode'
  | 'pdf_locked'
  | 'pdf_damaged'
  | 'network'
  | 'timeout'
  | 'server'
  | 'permission'
  | 'locker_full'
  | 'limit'
  | 'sign_in'
  | 'input'
  | 'unknown';

export type Explained = { kind: ErrorKind; task: ErrorTask; title: string; why: string; steps: string[]; detail: string };

type Translate = (key: TextKey, vars?: Record<string, string | number>) => string;

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'];

// iPhone photos (HEIC) that most browsers can't open.
export function isHeic(file?: Pick<WorkFile, 'name' | 'mimeType' | 'bytes'>) {
  if (!file) return false;
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.mimeType)) return true;
  const head = file.bytes?.subarray(4, 12);
  if (!head || head.length < 8) return false;
  const text = String.fromCharCode(...head);
  return text.startsWith('ftyp') && HEIC_BRANDS.includes(text.slice(4, 8));
}

const BIG_BYTES = 25 * 1024 * 1024;
const BIG_PIXELS = 40_000_000;

function tooBig(file?: WorkFile) {
  if (!file) return false;
  if (file.bytes.byteLength > (file.kind === 'pdf' ? 60 * 1024 * 1024 : BIG_BYTES)) return true;
  return !!file.width && !!file.height && file.width * file.height > BIG_PIXELS;
}

function messageOf(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof Event !== 'undefined' && error instanceof Event) return `${error.type} event`;
  if (typeof error === 'string') return error;
  const json = JSON.stringify(error);
  return json && json !== '{}' ? json : `${(error as object)?.constructor?.name ?? typeof error} without a message`;
}

// Works out the most likely cause from the error and the files involved.
export function errorKind(error: unknown, files: (WorkFile | undefined)[] = []): ErrorKind {
  if (error instanceof WorkbenchError) return error.kind;
  if (error instanceof LockerFullError) return 'locker_full';
  if (error instanceof QuickPrintError) return 'input';
  if (error instanceof ApiError) {
    if (error.status === 429) return 'limit';
    if (error.status === 401) return 'sign_in';
    if (error.status === 413) return 'too_big';
    if (error.status >= 500) return 'server';
  }
  // A picture that failed to load gives an event, not an error.
  if (!(error instanceof Error) && typeof error === 'object' && error && files.some((file) => file?.kind === 'image')) {
    return files.some((file) => isHeic(file)) ? 'heic' : 'decode';
  }
  const message = messageOf(error).toLowerCase();
  if (/network request failed|failed to fetch|networkerror|load failed|internet|offline/.test(message)) return 'network';
  if (/timed? ?out|timeout|abort/.test(message)) return 'timeout';
  if (/permission|denied|not allowed|notallowed/.test(message)) return 'permission';
  if (/encrypt|password/.test(message)) return 'pdf_locked';
  if (files.some((file) => isHeic(file))) return 'heic';
  if (/memory|rangeerror|allocation|too large|exceed|maximum call stack|canvas/.test(message) || files.some(tooBig)) return 'too_big';
  if (/decode|unsupported|invalid image|could not load|couldn.t load|image load|not an image|onerror|corrupt/.test(message)) return 'decode';
  if (/no pdf header|failed to parse|invalid pdf|pdf/.test(message) && files.some((file) => file?.kind === 'pdf')) return 'pdf_damaged';
  if (/\b5\d\d\b|server/.test(message)) return 'server';
  return 'unknown';
}

// Kinds worth a report: something the app may be getting wrong.
const REPORTED: ErrorKind[] = ['unknown', 'server', 'decode', 'too_big', 'pdf_damaged'];

export function explainError(error: unknown, task: ErrorTask, t: Translate, files: (WorkFile | undefined)[] = []): Explained {
  const kind = errorKind(error, files);
  const file = files.find(Boolean);
  const detail = messageOf(error).slice(0, 300);
  if (REPORTED.includes(kind)) reportError(`tool/${task}/${kind}`, error);
  const vars = {
    size: file ? formatSize(file.bytes.byteLength) : '',
    mp: file?.width && file.height ? Math.round((file.width * file.height) / 1_000_000) : '?',
  };
  // These errors already say why in plain words (the server's own words for
  // the AI limit).
  const plain =
    error instanceof WorkbenchError ||
    error instanceof LockerFullError ||
    error instanceof QuickPrintError ||
    (error instanceof ApiError && error.fromServer && kind === 'limit');
  const why = plain ? (error as Error).message : t(`err.why.${kind}` as TextKey, vars);
  const steps = t(`err.steps.${kind}` as TextKey, vars)
    .split('\n')
    .map((step) => step.trim())
    .filter(Boolean);
  return { kind, task, title: t(`err.title.${task}` as TextKey), why, steps, detail };
}

// The same explanation as one paragraph, for places that show a short note.
export function explainedText({ title, why, steps }: Explained) {
  return [`${title}.`, why, ...steps.map((step) => (/[.!?]$/.test(step) ? step : `${step}.`))].join(' ');
}
