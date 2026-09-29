// Privacy-friendly stats and error reports (supabase/migrations/0006_stats_errors.sql).
// Stats count steps, not people: "workbench.shrink_pdf" +1, with no user id,
// phone id or file names, sent in small batches. Error reports say what broke
// and where; the database masks long numbers. Without Supabase (demo mode)
// counts stay on this phone so the /admin page can still show them.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const LOCAL_KEY = 'vc-stats-local';
const FLUSH_MS = 15_000;
const NAME = /^[a-z0-9_]{1,30}(\.[a-z0-9_]{1,30}){0,2}$/;

let pending: Record<string, number> = {};
let timer: ReturnType<typeof setTimeout> | null = null;

// Sends what's waiting when the app goes to the background, so closing the
// app doesn't lose the last few counts.
AppState.addEventListener?.('change', (state) => {
  if (state !== 'active') flush();
});

// Makes a safe event name part: "shrink-pdf" -> "shrink_pdf".
export function eventPart(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'other';
}

export function track(name: string) {
  if (!NAME.test(name)) return;
  pending[name] = (pending[name] ?? 0) + 1;
  timer ??= setTimeout(flush, FLUSH_MS);
}

export async function flush() {
  timer = null;
  const batch = pending;
  pending = {};
  if (!Object.keys(batch).length) return;
  if (supabase) {
    const { error } = await supabase.rpc('count_events', { p_events: batch });
    // Before 0006 is run the function doesn't exist; the counts are dropped.
    if (error && !/function|schema cache/i.test(error.message)) console.warn('Stats not sent:', error.message);
    return;
  }
  try {
    const day = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    const saved = JSON.parse((await AsyncStorage.getItem(LOCAL_KEY)) ?? '{}') as Record<string, Record<string, number>>;
    const today = (saved[day] ??= {});
    for (const [name, n] of Object.entries(batch)) today[name] = (today[name] ?? 0) + n;
    for (const old of Object.keys(saved).sort().slice(0, -14)) delete saved[old];
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(saved));
  } catch {
    // No storage: counts are dropped.
  }
}

// Demo mode's counts on this phone, newest day first.
export async function localStats(): Promise<{ day: string; name: string; count: number }[]> {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(LOCAL_KEY)) ?? '{}') as Record<string, Record<string, number>>;
    return Object.entries(saved)
      .sort(([a], [b]) => b.localeCompare(a))
      .flatMap(([day, names]) => Object.entries(names).map(([name, count]) => ({ day, name, count })));
  } catch {
    return [];
  }
}

// Sends what broke and where. Never include details the person typed.
export function reportError(place: string, error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  track('app.error');
  if (!supabase) {
    console.warn(`[${place}]`, message);
    return;
  }
  supabase
    .rpc('report_error', {
      p_place: place.slice(0, 120),
      p_message: message.slice(0, 1000),
      p_platform: Platform.OS,
      p_version: Constants.expoConfig?.version ?? '',
    })
    .then(({ error: failed }) => failed && console.warn('Error report not sent:', failed.message));
}
