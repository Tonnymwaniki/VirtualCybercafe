// Who is calling an AI route. When the app is online for everyone, the AI
// routes need a signed-in user so strangers can't spend the Anthropic credit.
// The app sends the user's Supabase access token; we ask Supabase who it
// belongs to (with the public anon key only) and remember the answer briefly.

type Known = { userId: string | null; until: number };

// Kept on globalThis: the dev server can load this module again per request.
const shared = globalThis as { knownCallers?: Map<string, Known> };
const known = (shared.knownCallers ??= new Map<string, Known>());
const REMEMBER_MS = 5 * 60 * 1000;

// AI_REQUIRE_SIGN_IN=1 or 0 decides. Otherwise sign-in is needed only on the
// hosted app (a production server) with Supabase set up; on the PC dev server
// guests can still try the AI.
export function signInRequired() {
  const setting = process.env.AI_REQUIRE_SIGN_IN;
  if (setting === '1') return true;
  if (setting === '0') return false;
  const supabaseOn = !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return supabaseOn && process.env.NODE_ENV === 'production';
}

function tokenOf(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)$/.exec(header.trim());
  return match ? match[1] : null;
}

// The signed-in user's id, or null for a guest or a token that isn't valid.
export async function callerId(request: Request): Promise<string | null> {
  const token = tokenOf(request);
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return null;
  const now = Date.now();
  const saved = known.get(token);
  if (saved && saved.until > now) return saved.userId;
  let userId: string | null = null;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const user = (await response.json()) as { id?: unknown };
      if (typeof user.id === 'string') userId = user.id;
    } else if (response.status >= 500) {
      // Supabase is down: don't remember the failure.
      return null;
    }
  } catch {
    return null;
  }
  if (known.size > 1000) {
    for (const [key, value] of known) if (value.until <= now) known.delete(key);
    if (known.size > 1000) known.clear();
  }
  known.set(token, { userId, until: now + REMEMBER_MS });
  return userId;
}
