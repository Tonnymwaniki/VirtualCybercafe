// Print at any cyber: upload a PDF privately, get a short code and a QR code
// that any cyber can open on the public print page (/p), with no account.
// The codes, PIN checks and attempt limits live in the database
// (supabase/migrations/0004_quick_print.sql). Without Supabase (demo mode)
// codes are kept in this browser or phone only, for trying it out.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { renamed, toBase64, type WorkFile } from '@/lib/workbench/files';
import { joinFiles, pageCount } from '@/lib/workbench/pdf';

export const QUICK_PRINT_BUCKET = 'quickprint';
const MAX_BYTES = 20 * 1024 * 1024;
const DAY_SECONDS = 24 * 60 * 60;
const DEMO_KEY = 'quickprint:demo';
// Demo mode keeps the file in browser storage, which holds a few MB.
const DEMO_MAX_BYTES = 3 * 1024 * 1024;

export type QuickPrint = {
  id: string;
  code: string;
  fileName: string;
  bytes: number;
  pages: number;
  hasPin: boolean;
  expiresAt: string;
  openedAt: string | null;
  printedAt: string | null;
  filePath: string;
};

export type OpenResult =
  | { status: 'ok'; fileName: string; bytes: number; pages: number; url: string; downloadUrl: string; expiresAt: string }
  | { status: 'printed' | 'not_found' | 'pin_needed' | 'locked' | 'slow_down' | 'offline' }
  | { status: 'wrong_pin'; triesLeft: number };

export class QuickPrintError extends Error {}

export const displayCode = (code: string) => `VC-${code}`;

// Where the public print page lives: EXPO_PUBLIC_SITE_URL once the app is
// hosted, this site on the web, or the development server while testing.
export function siteUrl() {
  const configured = process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  const host = Constants.expoConfig?.hostUri;
  return host ? `http://${host}` : 'http://localhost:8081';
}

export const printPageUrl = (code?: string) => `${siteUrl()}/p${code ? `/${code}` : ''}`;

type DemoEntry = QuickPrint & { pin: string | null; failed: number; dataUrl: string };

async function readDemo(): Promise<Record<string, DemoEntry>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(DEMO_KEY)) ?? '{}');
  } catch {
    return {};
  }
}

async function writeDemo(entries: Record<string, DemoEntry>) {
  try {
    await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(entries));
  } catch {
    throw new QuickPrintError('This browser can’t keep the file. Connect the app to Supabase to print by code.');
  }
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function demoCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
}

function cleanCode(code: string) {
  let wanted = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (wanted.length === 8 && wanted.startsWith('VC')) wanted = wanted.slice(2);
  return wanted;
}

const live = (p: Pick<QuickPrint, 'printedAt' | 'expiresAt'>) => !p.printedAt && new Date(p.expiresAt).getTime() > Date.now();

// One PDF for the cyber: photos become A4 pages.
async function asPdf(file: WorkFile) {
  const pdf = file.kind === 'pdf' ? file : await joinFiles([file], renamed(file.name, '', 'pdf'));
  const pages = await pageCount(pdf);
  return { pdf, pages };
}

function safeName(name: string) {
  return name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'document.pdf';
}

export async function createQuickPrint(userId: string, file: WorkFile, pin?: string): Promise<QuickPrint> {
  if (pin && !/^\d{4}$/.test(pin)) throw new QuickPrintError('The PIN must be 4 numbers.');
  const { pdf, pages } = await asPdf(file);
  const bytes = pdf.bytes.byteLength;
  if (bytes > MAX_BYTES) throw new QuickPrintError('That file is over 20 MB. Shrink it in the Document Workbench first.');

  if (!supabase) {
    if (bytes > DEMO_MAX_BYTES) throw new QuickPrintError('In demo mode files must be under 3 MB. Connect the app to Supabase for bigger files.');
    const entry: DemoEntry = {
      id: demoCode(),
      code: demoCode(),
      fileName: pdf.name,
      bytes,
      pages,
      hasPin: !!pin,
      expiresAt: new Date(Date.now() + DAY_SECONDS * 1000).toISOString(),
      openedAt: null,
      printedAt: null,
      filePath: '',
      pin: pin || null,
      failed: 0,
      dataUrl: `data:application/pdf;base64,${toBase64(pdf.bytes)}`,
    };
    await writeDemo({ ...(await readDemo()), [entry.code]: entry });
    return entry;
  }

  const path = `${userId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}-${safeName(pdf.name)}`;
  const bucket = supabase.storage.from(QUICK_PRINT_BUCKET);
  const upload = await bucket.upload(path, pdf.bytes, { contentType: 'application/pdf', upsert: false });
  if (upload.error) throw new QuickPrintError('Couldn’t upload the file. Check your connection and try again.');
  const signed = await bucket.createSignedUrl(path, DAY_SECONDS);
  if (signed.error || !signed.data) {
    await bucket.remove([path]);
    throw new QuickPrintError('Couldn’t prepare the file for printing. Try again.');
  }
  const { data, error } = await supabase.rpc('create_quick_print', {
    p_file_path: path,
    p_file_name: pdf.name,
    p_mime_type: 'application/pdf',
    p_bytes: bytes,
    p_pages: pages,
    p_url: signed.data.signedUrl,
    p_pin: pin || null,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    await bucket.remove([path]);
    throw new QuickPrintError(error?.message.includes('Too many') ? error.message : 'Couldn’t make a print code. Try again.');
  }
  return {
    id: row.id,
    code: row.code,
    fileName: pdf.name,
    bytes,
    pages,
    hasPin: !!pin,
    expiresAt: row.expires_at,
    openedAt: null,
    printedAt: null,
    filePath: path,
  };
}

type Row = {
  id: string;
  code: string;
  file_name: string;
  bytes: number;
  pages: number;
  pin_hash: string | null;
  expires_at: string;
  opened_at: string | null;
  printed_at: string | null;
  file_path: string;
};

// The person's codes that still work. Printed and expired ones are removed,
// with their files.
export async function listQuickPrints(): Promise<QuickPrint[]> {
  if (!supabase) {
    const entries = await readDemo();
    const kept = Object.fromEntries(Object.entries(entries).filter(([, e]) => live(e)));
    if (Object.keys(kept).length !== Object.keys(entries).length) await writeDemo(kept);
    return Object.values(kept).sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));
  }
  const { data, error } = await supabase
    .from('quick_prints')
    .select('id, code, file_name, bytes, pages, pin_hash, expires_at, opened_at, printed_at, file_path')
    .order('created_at', { ascending: false });
  if (error) throw new QuickPrintError('Couldn’t load your print codes.');
  const rows = (data ?? []) as Row[];
  const finished = rows.filter((r) => !live({ printedAt: r.printed_at, expiresAt: r.expires_at }));
  if (finished.length) {
    await supabase.storage.from(QUICK_PRINT_BUCKET).remove(finished.map((r) => r.file_path));
    await supabase.from('quick_prints').delete().in('id', finished.map((r) => r.id));
  }
  return rows
    .filter((r) => !finished.includes(r))
    .map((r) => ({
      id: r.id,
      code: r.code,
      fileName: r.file_name,
      bytes: r.bytes,
      pages: r.pages,
      hasPin: !!r.pin_hash,
      expiresAt: r.expires_at,
      openedAt: r.opened_at,
      printedAt: r.printed_at,
      filePath: r.file_path,
    }));
}

// Stops the code working and deletes the file.
export async function cancelQuickPrint(print: QuickPrint) {
  if (!supabase) {
    const { [print.code]: _, ...rest } = await readDemo();
    await writeDemo(rest);
    return;
  }
  await supabase.from('quick_prints').delete().eq('id', print.id);
  await supabase.storage.from(QUICK_PRINT_BUCKET).remove([print.filePath]);
}

// The cyber's side: check the code and PIN and get the file. finish marks it
// printed, so the code stops working.
export async function openQuickPrint(code: string, pin?: string, finish = false): Promise<OpenResult> {
  const wanted = cleanCode(code);
  if (!supabase) {
    const entries = await readDemo();
    const entry = entries[wanted];
    if (!entry || !live(entry)) return { status: 'not_found' };
    if (entry.pin) {
      if (entry.failed >= 5) return { status: 'locked' };
      if (!pin) return { status: 'pin_needed' };
      if (pin !== entry.pin) {
        entry.failed += 1;
        await writeDemo(entries);
        return { status: 'wrong_pin', triesLeft: Math.max(0, 5 - entry.failed) };
      }
    }
    if (finish) {
      entry.printedAt = new Date().toISOString();
      await writeDemo(entries);
      return { status: 'printed' };
    }
    entry.openedAt ??= new Date().toISOString();
    await writeDemo(entries);
    return { status: 'ok', fileName: entry.fileName, bytes: entry.bytes, pages: entry.pages, url: entry.dataUrl, downloadUrl: entry.dataUrl, expiresAt: entry.expiresAt };
  }
  const { data, error } = await supabase.rpc('open_quick_print', { p_code: wanted, p_pin: pin || null, p_finish: finish });
  if (error || !data) return { status: 'offline' };
  const result = data as Record<string, unknown>;
  if (result.status === 'ok') {
    const url = String(result.url);
    return {
      status: 'ok',
      fileName: String(result.file_name),
      bytes: Number(result.bytes),
      pages: Number(result.pages),
      url,
      downloadUrl: `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(String(result.file_name))}`,
      expiresAt: String(result.expires_at),
    };
  }
  if (result.status === 'wrong_pin') return { status: 'wrong_pin', triesLeft: Number(result.tries_left ?? 0) };
  return { status: result.status as 'printed' | 'not_found' | 'pin_needed' | 'locked' | 'slow_down' };
}
