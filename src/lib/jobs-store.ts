// Saves the user's jobs. Signed-in users keep each job as a row in their
// private task_progress table (task_id "job:<id>", from
// supabase/migrations/0002_government.sql, so no new table is needed);
// guests and demo mode keep them on this device.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Job, JobAdvert } from '@/lib/jobs-types';
import { usesCloud } from '@/lib/profile-store';
import { supabase } from '@/lib/supabase';

export { GUEST_ID } from '@/lib/profile-store';

const PREFIX = 'job:';
const localKey = (userId: string) => `jobs:${userId}`;

async function readLocal(userId: string): Promise<Record<string, Job>> {
  try {
    const stored = await AsyncStorage.getItem(localKey(userId));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

async function writeLocal(userId: string, jobs: Record<string, Job>) {
  try {
    await AsyncStorage.setItem(localKey(userId), JSON.stringify(jobs));
  } catch {
    // Storage can be unavailable (private browsing); the screen still works.
  }
}

// Soonest deadline first; jobs without a deadline, then finished ones, last.
function byDeadline(a: Job, b: Job) {
  const doneA = a.closed || a.status >= 4;
  const doneB = b.closed || b.status >= 4;
  if (doneA !== doneB) return doneA ? 1 : -1;
  return (a.advert.deadline || '9999').localeCompare(b.advert.deadline || '9999') || b.createdAt.localeCompare(a.createdAt);
}

export async function loadJobs(userId: string): Promise<Job[]> {
  if (usesCloud(userId) && supabase) {
    const { data, error } = await supabase.from('task_progress').select('task_id, progress').like('task_id', `${PREFIX}%`);
    if (!error) return (data ?? []).map((row) => row.progress as Job).sort(byDeadline);
    console.warn('Could not load your jobs, using this device:', error.message);
  }
  return Object.values(await readLocal(userId)).sort(byDeadline);
}

export async function loadJob(userId: string, id: string): Promise<Job | null> {
  return (await loadJobs(userId)).find((job) => job.id === id) ?? null;
}

export async function saveJob(userId: string, job: Job): Promise<Job> {
  const stamped = { ...job, updatedAt: new Date().toISOString() };
  if (usesCloud(userId) && supabase) {
    const { error } = await supabase
      .from('task_progress')
      .upsert({ user_id: userId, task_id: PREFIX + job.id, progress: stamped, updated_at: stamped.updatedAt });
    if (!error) return stamped;
    console.warn('Could not save the job online, saving on this device:', error.message);
  }
  await writeLocal(userId, { ...(await readLocal(userId)), [job.id]: stamped });
  return stamped;
}

export async function deleteJob(userId: string, id: string): Promise<void> {
  if (usesCloud(userId) && supabase) {
    const { error } = await supabase.from('task_progress').delete().eq('task_id', PREFIX + id);
    if (!error) return;
    console.warn('Could not delete the job online:', error.message);
  }
  const { [id]: _, ...rest } = await readLocal(userId);
  await writeLocal(userId, rest);
}

export function newJob(advert: JobAdvert): Job {
  const now = new Date().toISOString();
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    advert,
    status: 0,
    statusDates: { 0: now },
    createdAt: now,
    updatedAt: now,
  };
}

// Whole days until the deadline; null when there is none.
export function daysLeft(deadline: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const end = new Date(`${deadline}T23:59:59`);
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000) - 1;
}

export function deadlineLabel(deadline: string): string {
  const days = daysLeft(deadline);
  if (days === null) return 'No deadline given';
  if (days < 0) return 'Closed';
  if (days === 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  return `${days} days left`;
}
