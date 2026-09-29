// Which Claude model the server routes use. Defaults to Claude Haiku 4.5, the
// cheapest; set ANTHROPIC_MODEL in .env (e.g. claude-opus-5-5) to switch.

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

// Haiku 4.5 doesn't take adaptive thinking, effort, refusal fallbacks or the
// newest web search tool, so those are only sent to the larger models.
const isHaiku = MODEL.startsWith('claude-haiku');

export const modelOptions = isHaiku
  ? {}
  : {
      thinking: { type: 'adaptive' as const },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default' as const,
    };

// Goes inside output_config.
export const effortOption = isHaiku ? {} : { effort: 'medium' as const };

export const webSearchType = isHaiku ? ('web_search_20250305' as const) : ('web_search_20260209' as const);
export const webFetchType = isHaiku ? ('web_fetch_20250910' as const) : ('web_fetch_20260209' as const);
