import Anthropic from '@anthropic-ai/sdk';

import { entryForPath } from '@/data/catalogue';
import { findGovTask } from '@/data/gov-tasks';
import type { ChatMessage, ChatResponse } from '@/lib/chat-types';
import { sampleReply } from '@/lib/sample-attendant';
import { runAttendant } from '@/server/attendant-agent';
import { withUsage } from '@/server/usage';

const MAX_IMAGE_BASE64 = 5_000_000;

// Keep only well-formed turns, cap their size, and make sure the history
// starts with the user, as the API requires.
function cleanHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages = raw
    .filter(
      (m): m is ChatMessage =>
        !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && (!!m.text.trim() || !!m.hadImage),
    )
    .slice(-30)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 8000), hadImage: m.hadImage === true }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  return messages;
}

export function POST(request: Request) {
  return withUsage(request, 'chat', () => handle(request));
}

async function handle(request: Request) {
  let messages: ChatMessage[];
  let taskId: unknown;
  let screenPath: unknown;
  let language: 'en' | 'sw' = 'en';
  let image: string | undefined;
  try {
    const body = await request.json();
    messages = cleanHistory(body?.messages);
    taskId = body?.taskId;
    screenPath = body?.screen;
    if (body?.language === 'sw') language = 'sw';
    if (typeof body?.image === 'string' && body.image) {
      if (body.image.length > MAX_IMAGE_BASE64) return Response.json({ error: 'That photo is too large' }, { status: 413 });
      image = body.image;
    }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const lastUser = messages[messages.length - 1];
  if (!lastUser || lastUser.role !== 'user') {
    return Response.json({ error: 'No user message' }, { status: 400 });
  }

  // Until an API key is configured, answer with canned sample replies.
  if (!process.env.ANTHROPIC_API_KEY) {
    if (image) {
      const reply =
        language === 'sw'
          ? 'Nimepokea picha yako. Kusoma picha kunahitaji AI ya mhudumu, ambayo bado haijawashwa kwenye seva hii. Niambie kwa maneno inaonyesha nini, nami nitakusaidia.'
          : 'I got your photo. Reading photos needs the AI attendant, which isn’t switched on for this server yet. Tell me in words what it shows and I’ll help.';
      return Response.json({ reply, actions: [], mode: 'sample' } satisfies ChatResponse);
    }
    return Response.json({ ...sampleReply(lastUser.text, language), mode: 'sample' } satisfies ChatResponse);
  }

  const auth = request.headers.get('Authorization');
  const accessToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  try {
    // From a "Help me here" button: the screen the user was on.
    const screen = typeof screenPath === 'string' ? entryForPath(screenPath.slice(0, 200)) : undefined;
    const task = findGovTask(typeof taskId === 'string' ? taskId : screen?.id);
    const { reply, actions } = await runAttendant(messages, accessToken, task, screen, language, image);
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
