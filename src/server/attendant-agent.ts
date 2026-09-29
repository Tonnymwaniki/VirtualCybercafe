// The AI attendant: Claude with a small set of tools, run in a loop until it
// has an answer. Tool calls that the user should act on become ChatActions
// (buttons in the chat).

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

import { appTools, guides, type AppToolId } from '@/data/guides';
import { services } from '@/data/services';
import type { ChatAction, ChatMessage } from '@/lib/chat-types';
import { effortOption, MODEL, modelOptions, webSearchType } from '@/server/model';

// Upper bound on model calls per user message, to cap cost and latency.
const MAX_STEPS = 6;

const SYSTEM_PROMPT = `You are the virtual attendant at Virtual Cybercafe, a mobile app that does what a Kenyan cybercafe does.
You get tasks done for people: government services (eCitizen, KRA, NTSA, passports, Good Conduct), jobs (CVs, cover letters, applications), education (KUCCPS, HELB), documents, printing, business registration, travel and bills.

How to work:
- Reply in the language the user writes in: Swahili, English or Sheng.
- Keep replies short and phone-friendly: short lines, simple bullets, then one question or next step.
- For a government or education process, call get_service_guide first and base your steps on it. If the user asks about current fees or deadlines, use web_search and say where the figure came from; otherwise tell them to check the official site.
- When one of the app's tools would do part of the job (passport photo, photos to PDF, shrinking a photo, CV builder, Locker), call open_app_tool so the user gets a button. Offer at most two buttons per reply.
- When the user is signed in and a task needs documents, call check_locker to see what they already have, and say what is still missing.
- When the user needs a letter, email, complaint, application text or similar, write it with create_document so they can download it as a PDF. Never invent facts about the user; ask for missing details first.
- You cannot submit forms or make payments on government sites for the user. Guide them step by step and prepare everything they need.`;

const tools: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: 'get_service_guide',
    description:
      'Look up the step-by-step guide for a Kenyan service: what the user needs, the steps, the official site, and which app tools help. Use before explaining any of these processes.',
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', enum: guides.map((g) => g.id) },
      },
      required: ['service_id'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'open_app_tool',
    description:
      'Show the user a button that opens one of the app’s own tools: passport_photo (crop and shrink a passport photo), photos_to_pdf (combine photos of documents into one PDF), shrink_photo (compress a photo to a size limit), cv_builder (guided CV and cover letter), locker (their private document storage), sign_in.',
    input_schema: {
      type: 'object',
      properties: {
        tool: { type: 'string', enum: Object.keys(appTools) },
      },
      required: ['tool'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'check_locker',
    description:
      'List the documents the signed-in user has saved in their Digital Locker (names and categories). Returns a note if they are not signed in.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: 'create_document',
    description:
      'Create a document the user can download as a PDF, such as a letter, email, complaint or application statement. Use plain text with blank lines between paragraphs.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short file title, e.g. "Leave request letter"' },
        body: { type: 'string', description: 'Full text of the document' },
      },
      required: ['title', 'body'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'share_link',
    description: 'Show the user a button that opens an official website, such as eCitizen or iTax.',
    input_schema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        url: { type: 'string' },
      },
      required: ['label', 'url'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: webSearchType,
    name: 'web_search',
    max_uses: 3,
    user_location: { type: 'approximate', country: 'KE', timezone: 'Africa/Nairobi' },
  },
];

type ToolContext = {
  accessToken: string | null;
  actions: ChatAction[];
};

async function checkLocker(accessToken: string | null): Promise<string> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return 'The Locker is in demo mode on this server, so its contents are not available.';
  if (!accessToken) return 'The user is not signed in. Offer the sign_in tool if they want to use their Locker.';

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return 'The sign-in has expired. Ask the user to sign in again.';

  const userId = userData.user.id;
  const categories = ['Documents', 'Photos', 'Certificates'];
  const lines: string[] = [];
  for (const category of categories) {
    const { data } = await supabase.storage.from('locker').list(`${userId}/${category}`);
    for (const item of data ?? []) {
      if (item.id) lines.push(`${category}: ${item.name.replace(/^\d+-/, '')}`);
    }
  }
  return lines.length ? lines.join('\n') : 'The Locker is empty.';
}

async function runTool(name: string, input: Record<string, unknown>, context: ToolContext): Promise<string> {
  switch (name) {
    case 'get_service_guide': {
      const guide = guides.find((g) => g.id === input.service_id);
      return guide ? JSON.stringify(guide) : 'No guide for that service.';
    }
    case 'open_app_tool': {
      const tool = input.tool as AppToolId;
      if (!appTools[tool]) return 'Unknown tool.';
      if (!context.actions.some((a) => a.type === 'open' && a.tool === tool)) {
        context.actions.push({ type: 'open', tool, ...appTools[tool] });
      }
      return `A button for "${appTools[tool].label}" is shown to the user.`;
    }
    case 'check_locker':
      return checkLocker(context.accessToken);
    case 'create_document': {
      const title = String(input.title ?? 'Document').slice(0, 120);
      const body = String(input.body ?? '');
      context.actions.push({ type: 'document', title, body });
      return `The document "${title}" is ready for the user to download as a PDF.`;
    }
    case 'share_link': {
      const url = String(input.url ?? '');
      if (!/^https:\/\//.test(url)) return 'Only https links can be shared.';
      context.actions.push({ type: 'link', label: String(input.label ?? 'Open'), url });
      return 'The link button is shown to the user.';
    }
    default:
      return `Unknown tool ${name}.`;
  }
}

export async function runAttendant(
  history: ChatMessage[],
  accessToken: string | null,
): Promise<{ reply: string; actions: ChatAction[] }> {
  const client = new Anthropic();
  const context: ToolContext = { accessToken, actions: [] };
  const serviceList = services.map((s) => `${s.title}: ${s.description}`).join('\n');

  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.text,
  }));

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      ...modelOptions,
      ...(Object.keys(effortOption).length ? { output_config: effortOption } : {}),
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        { type: 'text', text: `Services in the app:\n${serviceList}`, cache_control: { type: 'ephemeral' } },
      ],
      tools,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return { reply: 'Sorry, I can’t help with that one. Is there something else you need done?', actions: [] };
    }

    messages.push({ role: 'assistant', content: response.content });

    // A long web search can pause; send the turn back to let it continue.
    if (response.stop_reason === 'pause_turn') continue;

    const toolUses = response.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use',
    );
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const reply = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      return { reply, actions: context.actions };
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      let content: string;
      let isError = false;
      try {
        content = await runTool(toolUse.name, (toolUse.input ?? {}) as Record<string, unknown>, context);
      } catch (error) {
        content = `Tool failed: ${error instanceof Error ? error.message : String(error)}`;
        isError = true;
      }
      results.push({ type: 'tool_result', tool_use_id: toolUse.id, content, is_error: isError });
    }
    messages.push({ role: 'user', content: results });
  }

  return {
    reply: 'I got a bit stuck on that one. Could you tell me a little more about what you need?',
    actions: context.actions,
  };
}
