// Where the AI server keeps things between requests.
// - Hosted (EAS Hosting): the server can't keep files, so with AI_SERVER_KEY
//   set it calls the functions in supabase/migrations/0007_ai_server.sql,
//   using the public anon key plus that server key.
// - On the PC dev server (no AI_SERVER_KEY): files in .cache/ as before.

export function remoteStore() {
  const key = process.env.AI_SERVER_KEY;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || !url || !anonKey) return null;
  return {
    async call<T>(name: string, args: Record<string, unknown>): Promise<T> {
      const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_key: key, ...args }),
      });
      if (!response.ok) throw new Error(`${name}: ${response.status} ${(await response.text()).slice(0, 200)}`);
      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    },
  };
}
