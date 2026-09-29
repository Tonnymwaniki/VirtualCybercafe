import Anthropic from '@anthropic-ai/sdk';

import { entryForPath } from '@/data/catalogue';
import { findGovTask } from '@/data/gov-tasks';
import type { ChatMessage, ChatResponse, FileMeta } from '@/lib/chat-types';
import { sampleReply } from '@/lib/sample-attendant';
import { runAttendant } from '@/server/attendant-agent';
import { withUsage } from '@/server/usage';

const MAX_IMAGE_BASE64 = 5_000_000;
const MAX_PDF_BASE64 = 4_300_000;

type ChatFile = FileMeta & { newest?: boolean };

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined);

// Descriptions of the files in the chat (the files stay on the phone).
function cleanFiles(raw: unknown): ChatFile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f) => !!f && typeof f.id === 'string' && typeof f.name === 'string' && (f.kind === 'pdf' || f.kind === 'image'))
    .slice(-12)
    .map((f) => ({
      id: String(f.id).slice(0, 40),
      name: String(f.name).replace(/[\r\n]+/g, ' ').slice(0, 120),
      kind: f.kind,
      bytes: count(f.bytes) ?? 0,
      ...(count(f.pages) ? { pages: count(f.pages) } : {}),
      ...(count(f.width) ? { width: count(f.width), height: count(f.height) } : {}),
      ...(f.newest === true ? { newest: true } : {}),
    }));
}

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
  let files: ChatFile[] = [];
  let pdf: string | undefined;
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
    files = cleanFiles(body?.files);
    if (typeof body?.pdf === 'string' && body.pdf) {
      if (body.pdf.length > MAX_PDF_BASE64) return Response.json({ error: 'That PDF is too large to read' }, { status: 413 });
      pdf = body.pdf;
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
    if (files.some((f) => f.newest)) {
      const reply =
        language === 'sw'
          ? 'Nimepokea faili yako. Niambie wazi unachotaka, kwa mfano **"punguza chini ya 1MB"**, **"600x600"**, **"iwe PDF moja"**, **"kurasa 1-3"** au **"kwa HELB"**, nami nitaifanya hapa kwenye simu.'
          : 'I got your file. Tell me plainly what you need, for example **"under 1MB"**, **"600x600"**, **"make one PDF"**, **"pages 1-3"** or **"for HELB"**, and I’ll do it right here on your phone.';
      return Response.json({ reply, actions: [], mode: 'sample' } satisfies ChatResponse);
    }
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
    const { reply, actions } = await runAttendant(messages, accessToken, task, screen, language, image, files, pdf);
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
