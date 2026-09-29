import AsyncStorage from '@react-native-async-storage/async-storage';

// Calls the app's own API routes with a random id for this phone, so the
// server can apply the daily AI limit per device. The id identifies nothing
// about the person.

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

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-device-id', await getDeviceId());
  return fetch(path, { ...init, headers });
}
