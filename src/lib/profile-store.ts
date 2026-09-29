// Saves "My Details". Signed-in users keep them in their private Supabase row
// (the id_details table from supabase/migrations/0002_government.sql, which
// holds the whole profile); guests and demo mode keep them on this device.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { cleanProfile, type Profile } from '@/data/profile-fields';
import { supabase } from '@/lib/supabase';

export const GUEST_ID = 'guest';

export function usesCloud(userId: string) {
  return !!supabase && userId !== GUEST_ID && !userId.startsWith('demo-');
}

const localKey = (userId: string) => `gov:${userId}:id`;

export async function loadProfile(userId: string): Promise<Profile> {
  if (usesCloud(userId) && supabase) {
    const { data, error } = await supabase.from('id_details').select('details').maybeSingle();
    if (!error) return cleanProfile(data?.details ?? {});
    console.warn('Could not load your details, using this device:', error.message);
  }
  try {
    const stored = await AsyncStorage.getItem(localKey(userId));
    return stored ? cleanProfile(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
}

// Merges the changes into the saved profile and returns the result. An empty
// string clears a detail.
export async function saveProfile(userId: string, changes: Profile): Promise<Profile> {
  const current = await loadProfile(userId);
  const merged = cleanProfile({ ...current, ...changes });
  if (usesCloud(userId) && supabase) {
    const { error } = await supabase
      .from('id_details')
      .upsert({ user_id: userId, details: merged, updated_at: new Date().toISOString() });
    if (!error) return merged;
    console.warn('Could not save your details online, saving on this device:', error.message);
  }
  try {
    await AsyncStorage.setItem(localKey(userId), JSON.stringify(merged));
  } catch {
    // Storage can be unavailable (private browsing); the screen still works.
  }
  return merged;
}
