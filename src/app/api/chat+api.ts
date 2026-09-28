import Anthropic from '@anthropic-ai/sdk';

import type { ChatMessage, ChatResponse } from '@/lib/chat-types';
import { sampleReply } from '@/lib/sample-attendant';
import { runAttendant } from '@/server/attendant-agent';

// Keep only well-formed turns, cap their size, and make sure the history
// starts with the user, as the API requires.
function cleanHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages = raw
    .filter(
      (m): m is ChatMessage =>
        !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && !!m.text.trim(),
    )
    .slice(-30)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 8000) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  return messages;
}

export async function POST(request: Request) {
  let messages: ChatMessage[];
  try {
    messages = cleanHistory((await request.json())?.messages);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const lastUser = messages[messages.length - 1];
  if (!lastUser || lastUser.role !== 'user') {
    return Response.json({ error: 'No user message' }, { status: 400 });
  }

  // Until an API key is configured, answer with canned sample replies.
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ ...sampleReply(lastUser.text), mode: 'sample' } satisfies ChatResponse);
  }

  const auth = request.headers.get('Authorization');
  const accessToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  try {
    const { reply, actions } = await runAttendant(messages, accessToken);
    return Response.json({ reply, actions, mode: 'ai' } satisfies ChatResponse);
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
