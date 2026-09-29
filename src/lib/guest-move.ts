// Work done before signing in (My Details, jobs, chats, reminders, task
// progress) is kept on the phone under the guest id. At sign-in the person
// can bring it into their account, so nothing is stuck on the phone. The
// account always wins: a detail already on the account is never overwritten.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { CHAT_KEY } from '@/lib/chat-types';
import { loadAllProgress, saveProgress } from '@/lib/gov-store';
import { loadJobs, saveJob } from '@/lib/jobs-store';
import { GUEST_ID, loadProfile, saveProfile } from '@/lib/profile-store';
import { loadRecords, saveRecord } from '@/lib/record-store';
import type { GovTaskId } from '@/data/gov-tasks';
import type { Profile } from '@/data/profile-fields';

const PROFILE_KEY = `gov:${GUEST_ID}:id`;
const PROGRESS_KEY = `gov:${GUEST_ID}:progress`;
const JOBS_KEY = `jobs:${GUEST_ID}`;
const RECORDS_PREFIX = `records:${GUEST_ID}:`;

export type GuestWork = {
  details: number;
  jobs: number;
  chats: number;
  other: number;
  // For My Details: the name typed as a guest, to offer at sign-in.
  fullName?: string;
};

async function recordPrefixes() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter((key) => key.startsWith(RECORDS_PREFIX)).map((key) => key.slice(RECORDS_PREFIX.length));
  } catch {
    return [];
  }
}

// What a guest left on this phone; null when there is nothing.
export async function findGuestWork(): Promise<GuestWork | null> {
  const [profile, jobs, progress, prefixes] = await Promise.all([
    loadProfile(GUEST_ID),
    loadJobs(GUEST_ID),
    loadAllProgress(GUEST_ID),
    recordPrefixes(),
  ]);
  let chats = 0;
  let other = Object.keys(progress).length;
  for (const prefix of prefixes) {
    const count = Object.keys(await loadRecords(GUEST_ID, prefix)).length;
    if (prefix === CHAT_KEY) chats += count;
    else other += count;
  }
  const details = Object.values(profile).filter((value) => typeof value === 'string' && value.trim()).length;
  const work: GuestWork = { details, jobs: jobs.length, chats, other, fullName: profile.fullName || undefined };
  return details + work.jobs + chats + other > 0 ? work : null;
}

// Copies the guest's work into the account, then clears it from the guest
// space so it isn't copied twice or seen by the next guest on this phone.
export async function moveGuestWork(userId: string): Promise<void> {
  if (!userId || userId === GUEST_ID) return;

  const guestProfile = await loadProfile(GUEST_ID);
  if (Object.keys(guestProfile).length) {
    const account = await loadProfile(userId);
    const missing: Profile = {};
    for (const [key, value] of Object.entries(guestProfile) as [keyof Profile, string][]) {
      if (value && !account[key]) missing[key] = value;
    }
    if (Object.keys(missing).length) await saveProfile(userId, missing);
  }

  const accountJobs = new Set((await loadJobs(userId)).map((job) => job.id));
  for (const job of await loadJobs(GUEST_ID)) {
    if (accountJobs.has(job.id)) continue;
    // Guest Locker files lived only in this session's memory.
    const documents = (job.documents ?? []).filter((d) => !d.path.startsWith(`${GUEST_ID}/`));
    await saveJob(userId, { ...job, documents });
  }

  const accountProgress = await loadAllProgress(userId);
  for (const [taskId, progress] of Object.entries(await loadAllProgress(GUEST_ID))) {
    if (progress && !accountProgress[taskId as GovTaskId]) await saveProgress(userId, taskId as GovTaskId, progress);
  }

  const prefixes = await recordPrefixes();
  for (const prefix of prefixes) {
    const account = await loadRecords(userId, prefix);
    for (const [id, value] of Object.entries(await loadRecords(GUEST_ID, prefix))) {
      if (!(id in account)) await saveRecord(userId, prefix, id, value);
    }
  }

  await forgetGuestWork(prefixes);
}

// Clears the guest's work from this phone.
export async function forgetGuestWork(prefixes?: string[]) {
  const keys = [PROFILE_KEY, PROGRESS_KEY, JOBS_KEY, ...(prefixes ?? (await recordPrefixes())).map((p) => RECORDS_PREFIX + p)];
  try {
    await AsyncStorage.multiRemove(keys);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
