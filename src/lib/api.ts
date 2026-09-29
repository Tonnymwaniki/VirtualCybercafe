import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

// Calls the app's own API routes with a random id for this phone, so the
// server can apply the daily AI limit per device. The id identifies nothing
// about the person. When someone is signed in, their Supabase access token
// goes too: the hosted app only answers signed-in users.

const DEVICE_KEY = 'vc-device-id';
let deviceId: Promise<string> | null = null;

function randomId() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}

function getDeviceId() {
  deviceId ??= (async () => {
    try {
      const saved = await AsyncStorage.getItem(DEVICE_KEY);
      if (saved) return saved;
      const fresh = randomId();
      await AsyncStorage.setItem(DEVICE_KEY, fresh);
      return fresh;
    } catch {
      return randomId();
    }
  })();
  return deviceId;
}

async function accessToken() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// Screens listen for "sign in to use the AI" so one notice can show wherever
// the AI was asked, even when the feature falls back to a sample answer.
type Listener = (message: string) => void;
const signInListeners = new Set<Listener>();

export function onSignInNeeded(listener: Listener) {
  signInListeners.add(listener);
  return () => {
    signInListeners.delete(listener);
  };
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-device-id', await getDeviceId());
  const token = await accessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  if (response.status === 401) {
    try {
      const body = (await response.clone().json()) as { error?: string; signIn?: boolean };
      if (body.signIn) for (const listener of signInListeners) listener(body.error ?? '');
    } catch {
      // Not the sign-in answer.
    }
  }
  return response;
}
