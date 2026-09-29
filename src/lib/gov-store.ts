// Saves ID details and task progress. Signed-in users keep them in their
// private Supabase tables (supabase/migrations/0002_government.sql); guests and
// demo mode keep them on this device.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GovTaskId } from '@/data/gov-tasks';
import { emptyIdDetails, emptyProgress, type IdDetails, type TaskProgress } from '@/lib/gov-types';
import { supabase } from '@/lib/supabase';

export const GUEST_ID = 'guest';

function useCloud(userId: string) {
  return !!supabase && userId !== GUEST_ID && !userId.startsWith('demo-');
}

async function readLocal<T>(key: string, fallback: T): Promise<T> {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
}

async function writeLocal(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private browsing); the screen still works.
  }
}

export async function loadIdDetails(userId: string): Promise<IdDetails> {
  const key = `gov:${userId}:id`;
  if (useCloud(userId) && supabase) {
    const { data, error } = await supabase.from('id_details').select('details').maybeSingle();
    if (!error) return { ...emptyIdDetails, ...(data?.details ?? {}) };
    console.warn('Could not load ID details, using this device:', error.message);
  }
  return readLocal(key, emptyIdDetails);
}

export async function saveIdDetails(userId: string, details: IdDetails): Promise<void> {
  if (useCloud(userId) && supabase) {
    const { error } = await supabase
      .from('id_details')
      .upsert({ user_id: userId, details, updated_at: new Date().toISOString() });
    if (!error) return;
    console.warn('Could not save ID details online, saving on this device:', error.message);
  }
  await writeLocal(`gov:${userId}:id`, details);
}

export async function loadAllProgress(userId: string): Promise<Partial<Record<GovTaskId, TaskProgress>>> {
  if (useCloud(userId) && supabase) {
    const { data, error } = await supabase.from('task_progress').select('task_id, progress');
    if (!error) {
      return Object.fromEntries(
        (data ?? []).map((row) => [row.task_id, { ...emptyProgress, ...row.progress }]),
      );
    }
    console.warn('Could not load task progress, using this device:', error.message);
  }
  return readLocal(`gov:${userId}:progress`, {});
}

export async function saveProgress(userId: string, taskId: GovTaskId, progress: TaskProgress): Promise<void> {
  const stamped = { ...progress, updatedAt: new Date().toISOString() };
  if (useCloud(userId) && supabase) {
    const { error } = await supabase
      .from('task_progress')
      .upsert({ user_id: userId, task_id: taskId, progress: stamped, updated_at: stamped.updatedAt });
    if (!error) return;
    console.warn('Could not save task progress online, saving on this device:', error.message);
  }
  const all = await readLocal<Partial<Record<GovTaskId, TaskProgress>>>(`gov:${userId}:progress`, {});
  await writeLocal(`gov:${userId}:progress`, { ...all, [taskId]: stamped });
}
