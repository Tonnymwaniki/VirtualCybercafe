// Which model answers each AI feature, so the stronger (dearer) model is
// paid for only where quality shows: writing CVs, cover letters and other
// documents. Everything else (chat, reading adverts, checks, searches) uses
// the default model.
//
// .env settings, all optional:
//   ANTHROPIC_MODEL          default for every feature (claude-haiku-4-5)
//   ANTHROPIC_WRITING_MODEL  for the writing features below (default: ANTHROPIC_MODEL)
//   AI_MODELS                per-feature overrides, e.g.
//                            "chat=claude-sonnet-5-5,jobs.match=claude-haiku-4-5"
//
// Feature names are the route and its action, as in /api/usage: cv,
// jobs.tailor, business.write, travel.letter, chat, jobs.read_advert...

const DEFAULT_MODEL = 'claude-haiku-4-5';

export const WRITING_FEATURES = ['cv', 'jobs.tailor', 'business.write', 'travel.letter'];

function overrides(): Record<string, string> {
  const pairs = (process.env.AI_MODELS ?? '')
    .split(',')
    .map((item) => item.split('=').map((part) => part.trim()))
    .filter(([feature, model]) => feature && model && /^claude-[\w.-]+$/.test(model));
  return Object.fromEntries(pairs);
}

export function defaultModel() {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

// "jobs.tailor" matches an override for "jobs.tailor" first, then "jobs".
export function modelFor(feature: string | undefined): string {
  const base = defaultModel();
  if (!feature) return base;
  const route = feature.split('.')[0];
  const custom = overrides();
  if (custom[feature]) return custom[feature];
  if (custom[route]) return custom[route];
  if (WRITING_FEATURES.includes(feature) || WRITING_FEATURES.includes(route)) {
    return process.env.ANTHROPIC_WRITING_MODEL || base;
  }
  return base;
}

export const isHaikuModel = (model: string) => model.startsWith('claude-haiku');

type Body = Record<string, unknown> & {
  model?: string;
  tools?: { type?: string }[];
  output_config?: Record<string, unknown>;
};

// Rewrites a Messages request written for one model so another model can
// take it: Haiku 4.5 has no adaptive thinking, effort or server-side
// fallbacks, and uses the older web search and fetch tools. Returns the new
// body and whether the fallback beta may be sent.
export function adaptRequest(body: Body, model: string): { body: Body; fallbackBeta: boolean } {
  const haiku = isHaikuModel(model);
  const next: Body = { ...body, model };
  if (haiku) {
    delete next.thinking;
    delete next.fallbacks;
    if (next.output_config) {
      const { effort: _effort, ...rest } = next.output_config;
      if (Object.keys(rest).length) next.output_config = rest;
      else delete next.output_config;
    }
  } else {
    next.thinking ??= { type: 'adaptive' };
    next.fallbacks ??= 'default';
    next.output_config = { effort: 'medium', ...(next.output_config ?? {}) };
  }
  if (Array.isArray(next.tools)) {
    next.tools = next.tools.map((tool) => {
      if (tool.type?.startsWith('web_search_')) return { ...tool, type: haiku ? 'web_search_20250305' : 'web_search_20260209' };
      if (tool.type?.startsWith('web_fetch_')) return { ...tool, type: haiku ? 'web_fetch_20250910' : 'web_fetch_20260209' };
      return tool;
    });
  }
  return { body: next, fallbackBeta: !haiku };
}
