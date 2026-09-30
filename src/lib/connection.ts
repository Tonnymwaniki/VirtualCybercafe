// Whether the app can reach the internet, learned from real requests (and
// the browser's online/offline events on the web). No extra package or
// background pinging, so it costs no data.

import { Platform } from 'react-native';

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();
let online = true;

export function isOnline() {
  return online;
}

export function setOnline(next: boolean) {
  if (next === online) return;
  online = next;
  for (const listener of listeners) listener(online);
}

export function onConnectionChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// A network failure, as opposed to the server answering with an error.
export function isNetworkError(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && /network|failed to fetch|internet/i.test(error.message));
}

// Tries a tiny request to the app's own server; any answer means online.
export async function checkConnection() {
  try {
    await fetch('/api/usage', { method: 'HEAD', cache: 'no-store' });
    setOnline(true);
  } catch {
    setOnline(false);
  }
  return online;
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
  if (typeof navigator !== 'undefined' && navigator.onLine === false) online = false;
}
