import Anthropic from '@anthropic-ai/sdk';

import { findGovTask } from '@/data/gov-tasks';
import { cleanProfile } from '@/data/profile-fields';
import type { HelperMessage, HelperRequest } from '@/lib/gov-types';
import { runFormHelper, sampleHelp } from '@/server/form-helper';

const MAX_IMAGE_BASE64 = 5_000_000;

function strings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => typeof v === 'string')
      .map(([k, v]) => [k, (v as string).slice(0, 200)]),
  );
}

export async function POST(request: Request) {
  let body: Partial<HelperRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const task = findGovTask(body.taskId);
  if (!task) return Response.json({ error: 'Unknown task' }, { status: 400 });

  const messages: HelperMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.text === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return Response.json({ error: 'No user message' }, { status: 400 });
  }
  if (body.image !== undefined && (typeof body.image !== 'string' || body.image.length > MAX_IMAGE_BASE64)) {
    return Response.json({ error: 'Send one screenshot under 3 MB' }, { status: 400 });
  }

  const helperRequest: HelperRequest = {
    taskId: task.id,
    values: strings(body.values),
    profile: cleanProfile(strings(body.profile)),
    lockerFiles: (Array.isArray(body.lockerFiles) ? body.lockerFiles : []).filter((f) => typeof f === 'string').slice(0, 50),
    issues: (Array.isArray(body.issues) ? body.issues : [])
      .filter((i) => typeof i?.key === 'string' && typeof i?.message === 'string')
      .slice(0, 30),
    messages,
    image: body.image || undefined,
  };

  if (!process.env.ANTHROPIC_API_KEY) return Response.json(sampleHelp(task, helperRequest));

  try {
    return Response.json(await runFormHelper(task, helperRequest));
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error(error);
    }
    return Response.json({ error: 'The form helper is unavailable right now' }, { status: 502 });
  }
}
