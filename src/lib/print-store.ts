// Print Hub storage. With Supabase, shops and jobs live in the tables from
// supabase/migrations/0003_print.sql and files in the private "print"
// bucket. In demo mode (no Supabase) everything stays on this device, with a
// demo shop, so both the customer and the shop side can be tried.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

import { newCode, type PrintJob, type PrintShop, type PrintStatus } from '@/lib/print-types';
import { newId } from '@/lib/record-store';
import { supabase } from '@/lib/supabase';

export const PRINT_BUCKET = 'print';
export const DEMO_SHOP_ID = 'demo-shop';

const demoShop: PrintShop = {
  id: DEMO_SHOP_ID,
  ownerId: 'demo',
  name: 'Demo Cyber (test shop)',
  town: 'Nakuru',
  county: 'Nakuru',
  hours: 'Mon–Sat, 8 am – 7 pm',
  phone: '',
  priceBw: 10,
  priceColour: 30,
  active: true,
};

// ---- Demo mode (this device only) ----

async function readDemo<T>(key: string, fallback: T): Promise<T> {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

async function writeDemo(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private browsing).
  }
}

const demoShops = async () => [demoShop, ...(await readDemo<PrintShop[]>('print:shops', []))];
const demoJobs = () => readDemo<PrintJob[]>('print:jobs', []);

// ---- Rows <-> app shapes ----

type ShopRow = {
  id: string;
  owner_id: string;
  name: string;
  town: string;
  county: string;
  hours: string;
  phone: string;
  price_bw: number;
  price_colour: number;
  active: boolean;
};

const shopFromRow = (r: ShopRow): PrintShop => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  town: r.town,
  county: r.county,
  hours: r.hours,
  phone: r.phone,
  priceBw: Number(r.price_bw),
  priceColour: Number(r.price_colour),
  active: r.active,
});

type JobRow = {
  id: string;
  user_id: string;
  shop_id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  pages: number;
  copies: number;
  colour: boolean;
  double_sided: boolean;
  price: number;
  note: string;
  status: PrintStatus;
  created_at: string;
  updated_at: string;
};

const jobFromRow = (r: JobRow): PrintJob => ({
  id: r.id,
  userId: r.user_id,
  shopId: r.shop_id,
  code: r.code,
  customerName: r.customer_name,
  customerPhone: r.customer_phone,
  filePath: r.file_path,
  fileName: r.file_name,
  mimeType: r.mime_type,
  pages: r.pages,
  copies: r.copies,
  colour: r.colour,
  doubleSided: r.double_sided,
  price: Number(r.price),
  note: r.note,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ---- Shops ----

export async function listShops(): Promise<PrintShop[]> {
  if (!supabase) return demoShops();
  const { data, error } = await supabase.from('print_shops').select('*').eq('active', true).order('town');
  if (error) throw error;
  return (data as ShopRow[]).map(shopFromRow);
}

export async function findShop(id: string): Promise<PrintShop | null> {
  return (await listShops()).find((shop) => shop.id === id) ?? null;
}

export async function myShop(userId: string): Promise<PrintShop | null> {
  if (!supabase) return (await readDemo<PrintShop[]>('print:shops', [])).find((s) => s.ownerId === userId) ?? null;
  const { data, error } = await supabase.from('print_shops').select('*').eq('owner_id', userId).maybeSingle();
  if (error) throw error;
  return data ? shopFromRow(data as ShopRow) : null;
}

export type ShopInput = Omit<PrintShop, 'id' | 'ownerId' | 'active'>;

export async function saveShop(userId: string, input: ShopInput): Promise<PrintShop> {
  if (!supabase) {
    const shops = await readDemo<PrintShop[]>('print:shops', []);
    const existing = shops.find((s) => s.ownerId === userId);
    const shop: PrintShop = { ...input, id: existing?.id ?? newId(), ownerId: userId, active: true };
    await writeDemo('print:shops', [...shops.filter((s) => s.ownerId !== userId), shop]);
    return shop;
  }
  const row = {
    owner_id: userId,
    name: input.name,
    town: input.town,
    county: input.county,
    hours: input.hours,
    phone: input.phone,
    price_bw: input.priceBw,
    price_colour: input.priceColour,
  };
  const { data, error } = await supabase.from('print_shops').upsert(row, { onConflict: 'owner_id' }).select().single();
  if (error) throw error;
  return shopFromRow(data as ShopRow);
}

// ---- Jobs ----

export type SendInput = {
  userId: string;
  shop: PrintShop;
  file: { name: string; mimeType: string; bytes: ArrayBuffer; localUri?: string };
  pages: number;
  copies: number;
  colour: boolean;
  doubleSided: boolean;
  price: number;
  note: string;
  customerName: string;
  customerPhone: string;
};

const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'file';

export async function sendJob(input: SendInput): Promise<PrintJob> {
  const now = new Date().toISOString();
  if (!supabase) {
    const job: PrintJob = {
      id: newId(),
      userId: input.userId,
      shopId: input.shop.id,
      code: newCode(),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      filePath: '',
      fileName: input.file.name,
      mimeType: input.file.mimeType,
      pages: input.pages,
      copies: input.copies,
      colour: input.colour,
      doubleSided: input.doubleSided,
      price: input.price,
      note: input.note,
      status: 'sent',
      createdAt: now,
      updatedAt: now,
      localUri: input.file.localUri,
    };
    await writeDemo('print:jobs', [job, ...(await demoJobs())]);
    return job;
  }

  // Try a few codes in case one is already in use by an open job.
  let row: JobRow | null = null;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const { data, error } = await supabase
      .from('print_jobs')
      .insert({
        user_id: input.userId,
        shop_id: input.shop.id,
        code: newCode(),
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        file_name: input.file.name,
        mime_type: input.file.mimeType,
        pages: input.pages,
        copies: input.copies,
        colour: input.colour,
        double_sided: input.doubleSided,
        price: input.price,
        note: input.note,
      })
      .select()
      .single();
    if (!error) row = data as JobRow;
    else if (error.code !== '23505') throw error;
  }
  if (!row) throw new Error('Could not create a pickup code. Try again.');

  const path = `${row.id}/${safeName(input.file.name)}`;
  const upload = await supabase.storage
    .from(PRINT_BUCKET)
    .upload(path, input.file.bytes, { contentType: input.file.mimeType, upsert: false });
  if (upload.error) {
    await supabase.from('print_jobs').update({ status: 'cancelled' }).eq('id', row.id);
    throw upload.error;
  }
  const { data, error } = await supabase.from('print_jobs').update({ file_path: path }).eq('id', row.id).select().single();
  if (error) throw error;
  return jobFromRow(data as JobRow);
}

export async function myJobs(userId: string): Promise<PrintJob[]> {
  if (!supabase) return (await demoJobs()).filter((j) => j.userId === userId);
  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as JobRow[]).map(jobFromRow);
}

export async function shopJobs(shopId: string): Promise<PrintJob[]> {
  if (!supabase) return (await demoJobs()).filter((j) => j.shopId === shopId);
  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as JobRow[]).map(jobFromRow);
}

export async function getJob(id: string): Promise<PrintJob | null> {
  if (!supabase) return (await demoJobs()).find((j) => j.id === id) ?? null;
  const { data, error } = await supabase.from('print_jobs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? jobFromRow(data as JobRow) : null;
}

// Collected and cancelled jobs lose their file, so the shop can't open it again.
export async function setStatus(job: PrintJob, status: PrintStatus): Promise<PrintJob> {
  const updatedAt = new Date().toISOString();
  if (!supabase) {
    const jobs = await demoJobs();
    const next = { ...job, status, updatedAt, ...(status === 'collected' || status === 'cancelled' ? { localUri: undefined } : {}) };
    await writeDemo('print:jobs', jobs.map((j) => (j.id === job.id ? next : j)));
    return next;
  }
  // Remove the file first: storage only lets it be removed while the job is open.
  if ((status === 'collected' || status === 'cancelled') && job.filePath) {
    const { error: removeError } = await supabase.storage.from(PRINT_BUCKET).remove([job.filePath]);
    if (removeError) console.warn('Could not remove the print file:', removeError.message);
  }
  const { data, error } = await supabase.from('print_jobs').update({ status, updated_at: updatedAt }).eq('id', job.id).select().single();
  if (error) throw error;
  return jobFromRow(data as JobRow);
}

export async function openJobFile(job: PrintJob): Promise<void> {
  let url = job.localUri;
  if (supabase && job.filePath) {
    const { data, error } = await supabase.storage.from(PRINT_BUCKET).createSignedUrl(job.filePath, 300);
    if (error) throw error;
    url = data.signedUrl;
  }
  if (!url) throw new Error('This file is no longer available.');
  if (Platform.OS === 'web') window.open(url, '_blank');
  else await Linking.openURL(url);
}

// A document another screen (like a Business invoice) hands to Print Hub.
// The Print screen picks it up the next time it opens.
export type PendingPrint = { name: string; mimeType: string; bytes: ArrayBuffer; localUri?: string };

let pendingPrint: PendingPrint | null = null;

export function setPendingPrint(file: PendingPrint) {
  pendingPrint = file;
}

export function takePendingPrint(): PendingPrint | null {
  const file = pendingPrint;
  pendingPrint = null;
  return file;
}
