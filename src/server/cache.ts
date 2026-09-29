// A small cache for AI results (requirement checks, visa rules, job and
// tender searches) that survives server restarts, so the same question isn't
// paid for twice. Kept in .cache/ai-cache.json next to the project; on a host
// without a writable disk it quietly stays in memory.

import fs from 'node:fs';
import path from 'node:path';

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

// Map-like, so it drops in where the agents kept a Map.
export function persistentCache<T>(name: string) {
  return {
    get(key: string): { value: T; expires: number } | undefined {
      const entry = load()[`${name}:${key}`];
      return entry && entry.expires > Date.now() ? (entry as { value: T; expires: number }) : undefined;
    },
    set(key: string, entry: { value: T; expires: number }) {
      const store = load();
      store[`${name}:${key}`] = entry;
      save(store);
    },
  };
}
