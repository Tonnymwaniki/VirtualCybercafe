// Small private records (an Education plan, a saved admission letter) kept
// as rows in the signed-in user's task_progress table, with task_id
// "<prefix><id>", so no new table is needed. Guests and demo mode keep them
// on this device.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { usesCloud } from '@/lib/profile-store';
import { supabase } from '@/lib/supabase';

const localKey = (userId: string, prefix: string) => `records:${userId}:${prefix}`;

async function readLocal<T>(userId: string, prefix: string): Promise<Record<string, T>> {
  try {
    const stored = await AsyncStorage.getItem(localKey(userId, prefix));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

async function writeLocal(userId: string, prefix: string, value: unknown) {
  try {
    await AsyncStorage.setItem(localKey(userId, prefix), JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private browsing); the screen still works.
  }
}

export async function loadRecords<T>(userId: string, prefix: string): Promise<Record<string, T>> {
  if (usesCloud(userId) && supabase) {
    const { data, error } = await supabase.from('task_progress').select('task_id, progress').like('task_id', `${prefix}%`);
    if (!error) return Object.fromEntries((data ?? []).map((row) => [String(row.task_id).slice(prefix.length), row.progress as T]));
    console.warn('Could not load your saved items, using this device:', error.message);
  }
  return readLocal<T>(userId, prefix);
}

export async function saveRecord<T>(userId: string, prefix: string, id: string, value: T): Promise<void> {
  const updatedAt = new Date().toISOString();
  if (usesCloud(userId) && supabase) {
    const { error } = await supabase
      .from('task_progress')
      .upsert({ user_id: userId, task_id: prefix + id, progress: value, updated_at: updatedAt });
    if (!error) return;
    console.warn('Could not save online, saving on this device:', error.message);
  }
  await writeLocal(userId, prefix, { ...(await readLocal<T>(userId, prefix)), [id]: value });
}

export async function deleteRecord(userId: string, prefix: string, id: string): Promise<void> {
  if (usesCloud(userId) && supabase) {
    const { error } = await supabase.from('task_progress').delete().eq('task_id', prefix + id);
    if (!error) return;
    console.warn('Could not delete online:', error.message);
  }
  const { [id]: _, ...rest } = await readLocal(userId, prefix);
  await writeLocal(userId, prefix, rest);
}

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
