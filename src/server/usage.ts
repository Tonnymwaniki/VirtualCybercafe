// Usage log and daily limits for the AI features.
// - Each Claude reply is logged with its feature, tokens, web searches and an
//   estimated cost. /api/usage sums it up. Hosted, the log and the day's
//   counts live in Supabase (store.ts); on the PC in .cache/.
// - Each device, and each signed-in account, gets AI_DAILY_LIMIT AI requests a
//   day (default 40), and the whole app stops calling the AI for the day after
//   AI_DAILY_BUDGET_USD (default 1) is spent. Answers from the cache don't count.
// - On the hosted app the AI routes need a signed-in user (see caller.ts).

import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';

import { callerId, signInRequired } from '@/server/caller';
import { remoteStore } from '@/server/store';

type UsageNumbers = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export type UsageLine = {
  at: string;
  feature: string;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  searches: number;
  cost: number;
};

type Context = { feature: string; calls: number; lines: UsageLine[] };
type Today = { day: string; cost: number; devices: Record<string, number> };

const DIR = path.join(process.cwd(), '.cache');
const LOG_FILE = path.join(DIR, 'usage.jsonl');
const TODAY_FILE = path.join(DIR, 'usage-today.json');

const storage = new AsyncLocalStorage<Context>();
const shared = globalThis as { usageToday?: Today };

// US dollars per million tokens. Estimates; check anthropic.com/pricing.
const prices: [prefix: string, input: number, output: number][] = [
  ['claude-haiku', 1, 5],
  ['claude-sonnet', 3, 15],
  ['claude-opus', 5, 25],
];
const SEARCH_COST = 0.01;

export function estimateCost(model: string, usage: Omit<UsageLine, 'at' | 'feature' | 'model' | 'cost'>) {
  const [, input, output] = prices.find(([prefix]) => model.startsWith(prefix)) ?? ['', 3, 15];
  const tokens =
    usage.input * input + usage.cacheWrite * input * 1.25 + usage.cacheRead * input * 0.1 + usage.output * output;
  return tokens / 1_000_000 + usage.searches * SEARCH_COST;
}

// The day in Kenya, so limits reset at midnight Nairobi time.
function kenyaDay() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function today(): Today {
  const day = kenyaDay();
  if (shared.usageToday?.day === day) return shared.usageToday;
  let loaded: Today = { day, cost: 0, devices: {} };
  try {
    const saved = JSON.parse(fs.readFileSync(TODAY_FILE, 'utf8')) as Today;
    if (saved.day === day) loaded = saved;
  } catch {
    // Nothing saved yet.
  }
  shared.usageToday = loaded;
  return loaded;
}

function saveToday(state: Today) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(TODAY_FILE, JSON.stringify(state));
  } catch {
    // Memory only.
  }
}

// The feature the current request is for, e.g. "jobs.tailor".
export function currentFeature(): string | undefined {
  return storage.getStore()?.feature;
}

export async function recordUsage(model: string, usage: UsageNumbers) {
  const context = storage.getStore();
  if (context) context.calls += 1;
  const counts = {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    searches: usage.server_tool_use?.web_search_requests ?? 0,
  };
  const line: UsageLine = {
    at: new Date().toISOString(),
    feature: context?.feature ?? 'other',
    model,
    ...counts,
    cost: estimateCost(model, counts),
  };
  const remote = remoteStore();
  if (remote) {
    // Sent with the request's count in withUsage; on its own when the reply
    // came outside a tracked request.
    if (context) context.lines.push(line);
    else await remote.call('ai_finish', { p_who: [], p_lines: [line] }).catch((error) => console.warn('Usage not logged:', error));
    return;
  }
  const state = today();
  state.cost += line.cost;
  saveToday(state);
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(line)}\n`);
  } catch {
    // No disk: the daily total above still works.
  }
}

// Whether the request context follows awaits on this server. If it doesn't,
// every AI request is counted, whether or not it reached Claude.
let contextCheck: Promise<boolean> | null = null;
let warnedNoStore = false;
function contextWorks() {
  contextCheck ??= (async () => {
    const probe: Context = { feature: 'probe', calls: 0, lines: [] };
    try {
      return await storage.run(probe, async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return storage.getStore() === probe;
      });
    } catch {
      return false;
    }
  })();
  return contextCheck;
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function deviceOf(request: Request) {
  const id = request.headers.get('x-device-id') ?? '';
  return /^[a-z0-9-]{8,64}$/i.test(id) ? id : 'unknown';
}

export const limitMessages = {
  device: 'You’ve used today’s free AI help. It starts again tomorrow. Everything else in the app still works.',
  signIn: 'Please sign in with your phone number to use the AI helper. It’s free. Everything else in the app works without signing in.',
  budget: 'The AI helper has reached today’s limit. Please try again tomorrow. Everything else in the app still works.',
};

// Runs a route's AI work under the daily limits and tags its usage with the
// feature name. Returns a 429 when a limit is reached.
export async function withUsage(request: Request, feature: string, run: () => Promise<Response>): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return run();
  const userId = await callerId(request);
  if (!userId && signInRequired()) {
    return Response.json({ error: limitMessages.signIn, signIn: true }, { status: 401 });
  }
  const device = deviceOf(request);
  // Counted per phone and per account, so a new phone id doesn't reset an
  // account and one account can't be shared across many phones for free.
  const keys = userId ? [device, `user:${userId}`] : [device];
  const budget = numberFromEnv('AI_DAILY_BUDGET_USD', 1);
  const limit = numberFromEnv('AI_DAILY_LIMIT', 40);
  const remote = remoteStore();
  if (!remote && process.env.NODE_ENV === 'production' && !warnedNoStore) {
    warnedNoStore = true;
    console.warn('AI_SERVER_KEY is not set: AI limits and the cost log only last until the server restarts.');
  }
  let verdict: string = 'ok';
  if (remote) {
    // If Supabase can't be reached, the AI still answers; the Anthropic
    // Console's spend limit is the backstop.
    verdict = await remote
      .call<string>('ai_allow', { p_who: keys, p_limit: limit, p_budget: budget })
      .catch((error) => {
        console.warn('AI limits not checked:', error);
        return 'ok';
      });
  } else {
    const state = today();
    if (state.cost >= budget) verdict = 'budget';
    else if (keys.some((key) => (state.devices[key] ?? 0) >= limit)) verdict = 'device';
  }
  if (verdict === 'budget') return Response.json({ error: limitMessages.budget, limited: true }, { status: 429 });
  if (verdict === 'device') return Response.json({ error: limitMessages.device, limited: true }, { status: 429 });
  // Name the feature after the route and its action, e.g. travel.visa.
  let action = '';
  try {
    const body = (await request.clone().json()) as { action?: unknown };
    if (typeof body?.action === 'string') action = body.action.replace(/[^a-z_]/gi, '').slice(0, 30);
  } catch {
    // No JSON body.
  }
  const context: Context = { feature: action ? `${feature}.${action}` : feature, calls: 0, lines: [] };
  const tracked = await contextWorks();
  const response = await storage.run(context, run);
  const used = context.calls > 0 || !tracked;
  if (remote) {
    if (used || context.lines.length) {
      await remote
        .call('ai_finish', { p_who: used ? keys : [], p_lines: context.lines })
        .catch((error) => console.warn('AI use not counted:', error));
    }
  } else if (used) {
    const current = today();
    for (const key of keys) current.devices[key] = (current.devices[key] ?? 0) + 1;
    saveToday(current);
  }
  return response;
}

// Totals per feature for the last `days` days, from the log.
export async function usageSummary(days: number) {
  const remote = remoteStore();
  if (remote) {
    const totals = await remote.call<{
      totalCostUsd: number;
      features: Record<string, unknown>;
      todayCostUsd: number;
      devices: number;
      accounts: number;
    }>('ai_summary', { p_days: days });
    return {
      days,
      totalCostUsd: Number(totals.totalCostUsd),
      features: totals.features,
      today: {
        costUsd: Number(totals.todayCostUsd),
        budgetUsd: numberFromEnv('AI_DAILY_BUDGET_USD', 1),
        devices: totals.devices,
        accounts: totals.accounts,
        perDeviceLimit: numberFromEnv('AI_DAILY_LIMIT', 40),
      },
      note: 'Costs are estimates from token counts. Your Anthropic Console shows the real bill.',
    };
  }
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let lines: UsageLine[] = [];
  try {
    lines = fs
      .readFileSync(LOG_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((text) => JSON.parse(text) as UsageLine)
      .filter((line) => line.at >= since);
  } catch {
    // No log yet.
  }
  const features: Record<string, { calls: number; input: number; output: number; searches: number; cost: number }> = {};
  for (const line of lines) {
    const total = (features[line.feature] ??= { calls: 0, input: 0, output: 0, searches: 0, cost: 0 });
    total.calls += 1;
    total.input += line.input + line.cacheRead + line.cacheWrite;
    total.output += line.output;
    total.searches += line.searches;
    total.cost += line.cost;
  }
  const state = today();
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    days,
    totalCostUsd: round(lines.reduce((sum, line) => sum + line.cost, 0)),
    features: Object.fromEntries(Object.entries(features).map(([name, t]) => [name, { ...t, cost: round(t.cost) }])),
    today: {
      costUsd: round(state.cost),
      budgetUsd: numberFromEnv('AI_DAILY_BUDGET_USD', 1),
      devices: Object.keys(state.devices).filter((key) => !key.startsWith('user:')).length,
      accounts: Object.keys(state.devices).filter((key) => key.startsWith('user:')).length,
      perDeviceLimit: numberFromEnv('AI_DAILY_LIMIT', 40),
    },
    note: 'Costs are estimates from token counts. Your Anthropic Console shows the real bill.',
  };
}
