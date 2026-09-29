// The AI attendant: Claude with a small set of tools, run in a loop until it
// has an answer. Tool calls that the user should act on become ChatActions
// (buttons in the chat).

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

import type { GovTask } from '@/data/gov-tasks';
import { catalogue, findEntry, routeWith, type CatalogueEntry } from '@/data/catalogue';
import { guides } from '@/data/guides';
import { cleanProfile, profileFields } from '@/data/profile-fields';
import type { ChatAction, ChatMessage } from '@/lib/chat-types';
import { effortOption, MODEL, modelOptions, webSearchType } from '@/server/model';
import { claude } from '@/server/claude';

// Upper bound on model calls per user message, to cap cost and latency.
const MAX_STEPS = 6;

const SYSTEM_PROMPT = `You are the virtual attendant at Virtual Cybercafe, a mobile app that does what a Kenyan cybercafe does.
You get tasks done for people: government services (eCitizen, KRA, NTSA, passports, Good Conduct), jobs (CVs, cover letters, applications), education (KUCCPS, HELB), documents, printing, business registration, travel and bills.

How to work:
- Reply in the language the user writes in: Swahili, English or Sheng.
- Keep replies short and phone-friendly: short lines, simple bullets, then one question or next step.
- For a government or education process, call get_service_guide first and base your steps on it. If the user asks about current fees or deadlines, use web_search and say where the figure came from; otherwise tell them to check the official site.
- The app has a screen for most tasks, listed below under "Screens in the app". When one fits, call open_screen so the user gets a button straight to it, and say in one line what it will do for them. Offer at most two buttons per reply. Pass what the user already told you (destination, customer, topic, search words) so the screen opens filled in.
- The app's screens work from the user's saved details and Locker, track progress and warn about scams, so prefer them over long explanations.
- Warn plainly when it matters: no one can sell a tender or an LPO; working abroad on a visitor visa is illegal and no agent can guarantee a visa; any job advert that asks for a fee is a warning sign.
- When filling a form, writing a letter or CV, or checking what a task needs, call get_my_details to use what the user already saved (ID, contacts, KRA PIN, family, education, work experience, skills, business and passport) instead of asking again. Never make up personal details; ask for what is missing.
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
    name: 'open_screen',
    description:
      'Show the user a button that opens a screen of the app, from "Screens in the app". Some screens can open filled in: pass destination and purpose for travel, q (search words) for jobs and tenders, customer for invoices, receipts and quotations, topic for posters, posts and business plans. Leave the others out.',
    input_schema: {
      type: 'object',
      properties: {
        screen: { type: 'string', enum: catalogue.filter((e) => !e.hidden).map((e) => e.id) },
        destination: { type: 'string' },
        purpose: { type: 'string', enum: ['visit', 'tourism', 'study', 'work', 'business', 'medical'] },
        q: { type: 'string' },
        customer: { type: 'string' },
        topic: { type: 'string' },
      },
      required: ['screen'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_my_details',
    description:
      "Read the signed-in user's saved My Details: name, ID number, date of birth, contacts, KRA PIN, family and education. Use before asking for personal details.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
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
    // Web search rejects country KE, so only the timezone is sent.
    user_location: { type: 'approximate', timezone: 'Africa/Nairobi' },
  },
];

type ToolContext = {
  accessToken: string | null;
  actions: ChatAction[];
};

// A Supabase client acting as the signed-in user, so row-level security
// limits it to their own data. Returns a message string when that's not possible.
async function userClient(accessToken: string | null) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return 'Accounts are in demo mode on this server, so saved data is not available here.';
  if (!accessToken) return 'The user is not signed in. Offer open_screen sign_in if they want to use their saved data.';

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return 'The sign-in has expired. Ask the user to sign in again.';
  return { supabase, userId: data.user.id };
}

async function getMyDetails(accessToken: string | null): Promise<string> {
  const client = await userClient(accessToken);
  if (typeof client === 'string') return client;
  const { data, error } = await client.supabase.from('id_details').select('details').maybeSingle();
  if (error) return 'My Details could not be loaded.';
  const profile = cleanProfile(data?.details ?? {});
  const lines = profileFields.filter((f) => profile[f.key]).map((f) => `${f.label}: ${profile[f.key]}`);
  return lines.length
    ? `${lines.join('\n')}\n(Saved in My Details. The user can edit them under Locker > My Details.)`
    : 'My Details is empty. Offer to open it with open_screen profile.';
}

async function checkLocker(accessToken: string | null): Promise<string> {
  const client = await userClient(accessToken);
  if (typeof client === 'string') return client;
  const { supabase, userId } = client;

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
    case 'open_screen': {
      // Guides still name two tools by their old ids.
      const id = String(input.screen ?? '');
      const entry = findEntry(({ cv_builder: 'cv', my_details: 'profile' } as Record<string, string>)[id] ?? id);
      if (!entry) return 'Unknown screen.';
      const params = Object.fromEntries(
        (['destination', 'purpose', 'q', 'customer', 'topic'] as const)
          .filter((key) => typeof input[key] === 'string')
          .map((key) => [key, input[key] as string]),
      );
      const route = routeWith(entry, params);
      if (!context.actions.some((a) => a.type === 'open' && a.route === route)) {
        context.actions.push({ type: 'open', label: `Open ${entry.title}`, route });
      }
      return `A button that opens ${entry.title} is shown to the user.`;
    }
    case 'check_locker':
      return checkLocker(context.accessToken);
    case 'get_my_details':
      return getMyDetails(context.accessToken);
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

// The user opened the chat from inside a Government Services task.
function taskFocus(task: GovTask) {
  return `The user is working on one guided task in the app (Government Services or Education): ${task.title} (${task.agency}).
The workspace already shows them: what they need, a readiness checklist with Locker check, a form sheet with their details, payment steps and progress tracking. Answer questions about this task only, point them to the right step of the workspace, and use web search for current official facts.
Built-in steps for this task: ${task.steps.join(' ')}`;
}

// The user tapped "Help me here" on a screen.
function screenFocus(entry: CatalogueEntry) {
  return `The user opened this chat with the Help button on the "${entry.title}" screen (${entry.description}).${entry.help ? ` How that screen works: ${entry.help}` : ''}
Help them use that screen: explain the next thing to do there in plain steps. Only offer other screens if that one can't do what they need.`;
}

const catalogueText = catalogue
  .filter((e) => !e.hidden)
  .map((e) => `${e.id}: ${e.title}. ${e.description}`)
  .join('\n');

export async function runAttendant(
  history: ChatMessage[],
  accessToken: string | null,
  task?: GovTask,
  screen?: CatalogueEntry,
  language: 'en' | 'sw' = 'en',
): Promise<{ reply: string; actions: ChatAction[] }> {
  const client = claude();
  const context: ToolContext = { accessToken, actions: [] };

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
        { type: 'text', text: `Screens in the app (id: title):\n${catalogueText}`, cache_control: { type: 'ephemeral' } },
        ...(task ? [{ type: 'text' as const, text: taskFocus(task) }] : []),
        ...(screen && !task ? [{ type: 'text' as const, text: screenFocus(screen) }] : []),
        ...(language === 'sw'
          ? [{ type: 'text' as const, text: 'The user set the app to Kiswahili. Reply in Swahili unless they write to you in English.' }]
          : []),
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
