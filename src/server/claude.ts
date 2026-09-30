// The one place the server makes an Anthropic client.
// - Each request goes to the model planned for its feature (model-plan.ts),
//   so writing features can use a stronger model than the rest.
// - Every reply's token and web search counts are recorded, so the usage log
//   shows what each feature costs.

import Anthropic from '@anthropic-ai/sdk';

import { adaptRequest, modelFor } from '@/server/model-plan';
import { currentFeature, recordUsage } from '@/server/usage';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

function isMessagesCall(url: string) {
  return /\/v1\/messages(\?|$)/.test(url);
}

// Sends the request to the planned model, adjusting options that differ
// between models.
function planned(init: RequestInit | undefined): RequestInit | undefined {
  if (!init || typeof init.body !== 'string') return init;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(init.body);
  } catch {
    return init;
  }
  const model = modelFor(currentFeature());
  if (!body.model || body.model === model) return init;
  const adapted = adaptRequest(body, model);
  const headers = new Headers(init.headers);
  const betas = (headers.get('anthropic-beta') ?? '')
    .split(',')
    .map((beta) => beta.trim())
    .filter((beta) => beta && beta !== FALLBACK_BETA);
  if (adapted.fallbackBeta) betas.push(FALLBACK_BETA);
  if (betas.length) headers.set('anthropic-beta', betas.join(','));
  else headers.delete('anthropic-beta');
  return { ...init, headers, body: JSON.stringify(adapted.body) };
}

const meteredFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const response = await fetch(input, isMessagesCall(url) ? planned(init) : init);
  if (response.ok && isMessagesCall(url)) {
    try {
      const body = (await response.clone().json()) as { model?: string; usage?: Anthropic.Beta.BetaUsage };
      if (body.usage) await recordUsage(body.model ?? '', body.usage);
    } catch {
      // Not JSON (a stream): not counted.
    }
  }
  return response;
};

export function claude() {
  return new Anthropic({ fetch: meteredFetch });
}
