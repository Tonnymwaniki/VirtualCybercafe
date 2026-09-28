import Anthropic from '@anthropic-ai/sdk';

import type { ChatMessage, ChatResponse } from '@/lib/chat-types';
import { sampleReply } from '@/lib/sample-attendant';

const SYSTEM_PROMPT = `You are the virtual attendant at Virtual Cybercafe, a mobile app that does what a Kenyan cybercafe does.
You help people with government services (eCitizen, KRA, NTSA, passports, Good Conduct), jobs (CVs, cover letters, applications), education (KUCCPS, HELB, school forms), documents (PDFs, photos, formatting), printing, business services, travel and visas, and paying bills.
Reply in the language the user writes in: Swahili, English or Sheng.
Be warm and brief. Use short lines and simple bullet lists that read well on a phone. List the exact requirements (documents, photo sizes, fees in KSh) when you know them, then ask one question to move the task forward.
If you are not sure of a current fee or rule, say so and suggest checking the official site.`;

function toAnthropicMessages(messages: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  return messages.map((message) => ({ role: message.role, content: message.text }));
}

export async function POST(request: Request) {
  let messages: ChatMessage[];
  try {
    const body = await request.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser || typeof lastUser.text !== 'string') {
    return Response.json({ error: 'No user message' }, { status: 400 });
  }

  // Until an API key is configured, answer with canned sample replies.
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ reply: sampleReply(lastUser.text), mode: 'sample' } satisfies ChatResponse);
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: toAnthropicMessages(messages),
    });

    if (response.stop_reason === 'refusal') {
      return Response.json({
        reply: 'Sorry, I can’t help with that one. Is there something else you need done?',
        mode: 'ai',
      } satisfies ChatResponse);
    }

    const reply = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return Response.json({ reply, mode: 'ai' } satisfies ChatResponse);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic API key is invalid');
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error('Anthropic rate limit hit');
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error(error);
    }
    return Response.json({ error: 'The attendant is unavailable right now' }, { status: 502 });
  }
}
