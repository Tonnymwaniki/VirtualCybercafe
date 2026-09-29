// The one place the server makes an Anthropic client. Every reply's token
// and web search counts are recorded, so the usage log shows what each
// feature costs.

import Anthropic from '@anthropic-ai/sdk';

import { recordUsage } from '@/server/usage';

const meteredFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (response.ok && /\/v1\/messages(\?|$)/.test(url)) {
    try {
      const body = (await response.clone().json()) as { model?: string; usage?: Anthropic.Beta.BetaUsage };
      if (body.usage) recordUsage(body.model ?? '', body.usage);
    } catch {
      // Not JSON (a stream): not counted.
    }
  }
  return response;
};

export function claude() {
  return new Anthropic({ fetch: meteredFetch });
}
