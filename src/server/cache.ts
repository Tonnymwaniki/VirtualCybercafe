// A small cache for AI results (requirement checks, visa rules, job and
// tender searches) that survives server restarts, so the same question isn't
// paid for twice. Hosted, it lives in Supabase (store.ts); on the PC it's
// kept in .cache/ai-cache.json next to the project.

import fs from 'node:fs';
import path from 'node:path';

import { remoteStore } from '@/server/store';

type Entry = { value: unknown; expires: number };
type Store = Record<string, Entry>;

const FILE = path.join(process.cwd(), '.cache', 'ai-cache.json');
const MAX_ENTRIES = 1000;

// On globalThis so the dev server's route reloads share one copy.
const shared = globalThis as { aiCacheStore?: Store };

function load(): Store {
  if (shared.aiCacheStore) return shared.aiCacheStore;
  let store: Store = {};
  try {
    store = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Store;
  } catch {
    // No file yet, or no disk.
  }
  shared.aiCacheStore = store;
  return store;
}

function save(store: Store) {
  const now = Date.now();
  const live = Object.entries(store)
    .filter(([, entry]) => entry.expires > now)
    .sort((a, b) => b[1].expires - a[1].expires)
    .slice(0, MAX_ENTRIES);
  const pruned = Object.fromEntries(live);
  shared.aiCacheStore = pruned;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(pruned));
  } catch {
    // Memory only.
  }
}

// Map-like, so it drops in where the agents kept a Map. A cache that can't be
// reached counts as a miss; the answer is simply worked out again.
export function persistentCache<T>(name: string) {
  return {
    async get(key: string): Promise<{ value: T; expires: number } | undefined> {
      const remote = remoteStore();
      if (remote) {
        try {
          const entry = await remote.call<{ value: T; expires: number } | null>('ai_cache_get', { p_name: `${name}:${key}` });
          return entry ?? undefined;
        } catch (error) {
          console.warn('AI cache not read:', error);
          return undefined;
        }
      }
      const entry = load()[`${name}:${key}`];
      return entry && entry.expires > Date.now() ? (entry as { value: T; expires: number }) : undefined;
    },
    async set(key: string, entry: { value: T; expires: number }) {
      const remote = remoteStore();
      if (remote) {
        try {
          await remote.call('ai_cache_set', { p_name: `${name}:${key}`, p_value: entry.value, p_expires_ms: Math.round(entry.expires) });
        } catch (error) {
          console.warn('AI cache not saved:', error);
        }
        return;
      }
      const store = load();
      store[`${name}:${key}`] = entry;
      save(store);
    },
  };
}
