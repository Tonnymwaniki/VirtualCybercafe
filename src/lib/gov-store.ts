// Saves Government task progress. Signed-in users keep it in their private
// Supabase table (supabase/migrations/0002_government.sql); guests and demo
// mode keep it on this device. My Details live in profile-store.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GovTaskId } from '@/data/gov-tasks';
import { emptyProgress, type TaskProgress } from '@/lib/gov-types';
import { usesCloud } from '@/lib/profile-store';
import { supabase } from '@/lib/supabase';

export { GUEST_ID } from '@/lib/profile-store';

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

export async function loadAllProgress(userId: string): Promise<Partial<Record<GovTaskId, TaskProgress>>> {
  if (usesCloud(userId) && supabase) {
    const { data, error } = await supabase.from('task_progress').select('task_id, progress');
    if (!error) {
      return Object.fromEntries(
        (data ?? [])
          .filter((row) => !String(row.task_id).startsWith('job:'))
          .map((row) => [row.task_id, { ...emptyProgress, ...row.progress }]),
      );
    }
    console.warn('Could not load task progress, using this device:', error.message);
  }
  return readLocal(`gov:${userId}:progress`, {});
}

export async function saveProgress(userId: string, taskId: GovTaskId, progress: TaskProgress): Promise<void> {
  const stamped = { ...progress, updatedAt: new Date().toISOString() };
  if (usesCloud(userId) && supabase) {
    const { error } = await supabase
      .from('task_progress')
      .upsert({ user_id: userId, task_id: taskId, progress: stamped, updated_at: stamped.updatedAt });
    if (!error) return;
    console.warn('Could not save task progress online, saving on this device:', error.message);
  }
  const all = await readLocal<Partial<Record<GovTaskId, TaskProgress>>>(`gov:${userId}:progress`, {});
  await writeLocal(`gov:${userId}:progress`, { ...all, [taskId]: stamped });
}
