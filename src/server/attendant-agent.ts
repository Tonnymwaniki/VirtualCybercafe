// The AI attendant: Claude with a small set of tools, run in a loop until it
// has an answer. Tool calls that the user should act on become ChatActions
// (buttons in the chat).

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

import { bizTasks, eduTasks, findGovTask, govTasks, travelTasks, type GovTask } from '@/data/gov-tasks';
import { catalogue, findEntry, routeWith, type CatalogueEntry } from '@/data/catalogue';
import { guides } from '@/data/guides';
import { cleanProfile, profileFields } from '@/data/profile-fields';
import type { ChatAction, ChatMessage, ProposedAction } from '@/lib/chat-types';
import { mergeSignals, scamSignals } from '@/lib/job-scam';
import { effortOption, MODEL, modelOptions, webFetchType, webSearchType } from '@/server/model';
import { claude } from '@/server/claude';

// Upper bound on model calls per user message, to cap cost and latency.
const MAX_STEPS = 6;

const ALL_TASKS = [...govTasks, ...eduTasks, ...bizTasks, ...travelTasks];

const SYSTEM_PROMPT = `You are the virtual attendant at Virtual Cybercafe, a mobile app that does what a Kenyan cybercafe does.
You get tasks done for people: government services (eCitizen, KRA, NTSA, passports, Good Conduct), jobs (CVs, cover letters, applications), education (KUCCPS, HELB), documents, printing, business registration, travel and bills.

How to work:
- Reply in the language the user writes in: Swahili, English or Sheng.
- Keep replies short and phone-friendly. Write in Markdown: a short opening line, then **bold** for key words, "-" bullets or "1." steps, and "###" headings only when there are two or more sections. No tables. End with one question or next step.
- Show structured information as cards instead of long text: show_checklist for documents or things they need, show_steps for a step-by-step process, show_fee for an amount to pay (with its source), show_warning for scams or safety risks. Don't repeat a card's contents in your text; just refer to it ("Here's what you need:").
- If the user sends a photo (an error screen, a form, a document), read it and explain plainly what it shows and what to do. Never repeat ID numbers or other personal numbers from a photo back in full.
- For a government or education process, call get_service_guide first and base your steps on it. If the user asks about current fees or deadlines, use web_search and say where the figure came from; otherwise tell them to check the official site.
- The app has a screen for most tasks, listed below under "Screens in the app". When one fits, call open_screen so the user gets a button straight to it, and say in one line what it will do for them. Offer at most two buttons per reply. Pass what the user already told you (destination, customer, topic, search words) so the screen opens filled in.
- The app's screens work from the user's saved details and Locker, track progress and warn about scams, so prefer them over long explanations.
- Warn plainly when it matters: no one can sell a tender or an LPO; working abroad on a visitor visa is illegal and no agent can guarantee a visa; any job advert that asks for a fee is a warning sign.
- When filling a form, writing a letter or CV, or checking what a task needs, call get_my_details to use what the user already saved (ID, contacts, KRA PIN, family, education, work experience, skills, business and passport) instead of asking again. Never make up personal details; ask for what is missing.
- When the user is signed in and a task needs documents, call check_locker to see what they already have, and say what is still missing.
- When the user needs a letter, email, complaint, application text or similar, write it with create_document so they can download it as a PDF. Never invent facts about the user; ask for missing details first.
- Work alongside the user like a cybercafe attendant: when a step can be done in the app, offer to do it with an action tool. The user sees a card and nothing changes until they tap "Do it", so offer the action and say in one line what it will do.
  - save_my_details when the user tells you (or shows in a photo) a detail such as their KRA PIN, email or passport expiry. Only values they gave in this chat, never guesses.
  - start_task when they want to begin a guided task; pass form answers they already gave.
  - track_job when they paste or describe a job advert they want to apply for.
  - track_trip when they plan travel with a destination.
  - add_reminder for a deadline or date they should not miss (YYYY-MM-DD).
  Offer at most two actions per reply.
- When the user pastes a link, or you need the text of an official page, use web_fetch to read it and summarise what matters.
- You cannot submit forms, log in or make payments on government sites for the user, and never ask for passwords, PINs or OTP codes. Guide them step by step and prepare everything they need.`;

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
    name: 'show_checklist',
    description: 'Show a checklist card of documents or things the user needs. Items are short (a few words each).',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'e.g. "What you need"' },
        items: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'items'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'show_steps',
    description: 'Show a numbered steps card for a process. Each step is one short sentence.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        steps: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'steps'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'show_fee',
    description: 'Show a fee card. Only for an amount from a guide or an official source you found; give the source.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: 'e.g. "KSh 1,050"' },
        note: { type: 'string', description: 'What it covers and how to pay, one line.' },
        source: { type: 'string', description: 'Where the figure came from, e.g. "ecitizen.go.ke" or "Our saved guide".' },
      },
      required: ['amount', 'note', 'source'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'show_warning',
    description: 'Show a red warning card about a scam or a safety risk. One or two sentences.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
      additionalProperties: false,
    },
    strict: true,
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
    name: 'save_my_details',
    description:
      'Offer to save details the user gave in this chat to My Details, so every form fills from them. Shows a card; nothing is saved until they confirm.',
    input_schema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', enum: profileFields.map((f) => f.key) },
              value: { type: 'string' },
            },
            required: ['key', 'value'],
            additionalProperties: false,
          },
        },
      },
      required: ['fields'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'start_task',
    description:
      'Offer to start a guided task in the app. It ticks the documents already in their Locker and fills the form answers you pass (only answers the user gave). Shows a card; nothing changes until they confirm.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', enum: ALL_TASKS.map((t) => t.id) },
        answers: {
          type: 'array',
          items: {
            type: 'object',
            properties: { key: { type: 'string' }, value: { type: 'string' } },
            required: ['key', 'value'],
            additionalProperties: false,
          },
        },
      },
      required: ['task_id', 'answers'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'track_job',
    description:
      'Offer to save a job advert the user wants to apply for, so the Jobs workspace can match it, write the CV and letter, and track it. Use only facts from the advert; leave unknown fields empty.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        employer: { type: 'string' },
        location: { type: 'string' },
        deadline: { type: 'string', description: 'YYYY-MM-DD, or empty' },
        deadline_text: { type: 'string' },
        salary: { type: 'string' },
        how_to_apply: { type: 'string' },
        apply_email: { type: 'string' },
        apply_url: { type: 'string' },
        requirements: { type: 'array', items: { type: 'string' } },
        documents: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'employer', 'location', 'deadline', 'deadline_text', 'salary', 'how_to_apply', 'apply_email', 'apply_url', 'requirements', 'documents'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'track_trip',
    description: 'Offer to save a trip in the Travel workspace, which then checks the visa, documents and passport validity.',
    input_schema: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Country' },
        purpose: { type: 'string', enum: ['visit', 'tourism', 'study', 'work', 'business', 'medical'] },
        depart_date: { type: 'string', description: 'YYYY-MM-DD, or empty' },
        return_date: { type: 'string', description: 'YYYY-MM-DD, or empty' },
      },
      required: ['destination', 'purpose', 'depart_date', 'return_date'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'add_reminder',
    description:
      'Offer to add a reminder for a deadline or date to "Continue" on the Home screen. screen is the app screen that helps with it, or "none".',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short, e.g. "HELB application closes"' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        screen: { type: 'string', enum: ['none', ...catalogue.filter((e) => !e.hidden).map((e) => e.id)] },
      },
      required: ['title', 'date', 'screen'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: webFetchType,
    name: 'web_fetch',
    max_uses: 2,
    max_content_tokens: 8000,
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

// Adds an action card the user confirms in the chat.
function offer(context: ToolContext, action: ProposedAction): string {
  if (context.actions.filter((a) => a.type === 'confirm').length >= 2) return 'Only two actions per reply; offer the rest later.';
  context.actions.push({ type: 'confirm', id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, action });
  return 'A card is shown to the user. Nothing has changed yet: they tap "Do it" to confirm. Do not say it is done.';
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
    case 'show_checklist': {
      const items = (Array.isArray(input.items) ? input.items : []).map((i) => String(i).slice(0, 120)).slice(0, 12);
      context.actions.push({ type: 'checklist', title: String(input.title ?? 'What you need').slice(0, 60), items });
      return 'The checklist card is shown.';
    }
    case 'show_steps': {
      const steps = (Array.isArray(input.steps) ? input.steps : []).map((i) => String(i).slice(0, 200)).slice(0, 12);
      context.actions.push({ type: 'steps', title: String(input.title ?? 'Steps').slice(0, 60), steps });
      return 'The steps card is shown.';
    }
    case 'show_fee': {
      context.actions.push({
        type: 'fee',
        amount: String(input.amount ?? '').slice(0, 40),
        note: String(input.note ?? '').slice(0, 200),
        source: String(input.source ?? '').slice(0, 80),
      });
      return 'The fee card is shown.';
    }
    case 'show_warning': {
      context.actions.push({ type: 'warning', text: String(input.text ?? '').slice(0, 300) });
      return 'The warning card is shown.';
    }
    case 'save_my_details': {
      const raw = Array.isArray(input.fields) ? (input.fields as { key: string; value: string }[]) : [];
      const clean = cleanProfile(Object.fromEntries(raw.map((f) => [f.key, f.value])));
      const fields = profileFields.filter((f) => clean[f.key]).map((f) => ({ key: f.key, label: f.label, value: clean[f.key] }));
      if (!fields.length) return 'Nothing to save: give at least one detail with a value.';
      return offer(context, { kind: 'details', fields });
    }
    case 'start_task': {
      const task = findGovTask(String(input.task_id ?? ''));
      if (!task) return 'Unknown task.';
      const raw = Array.isArray(input.answers) ? (input.answers as { key: string; value: string }[]) : [];
      const answers = task.fields
        .map((field) => ({ key: field.key, label: field.label, value: String(raw.find((a) => a.key === field.key)?.value ?? '').trim().slice(0, 300) }))
        .filter((a) => a.value);
      return offer(context, { kind: 'task', taskId: task.id, title: task.title, answers });
    }
    case 'track_job': {
      const text = (key: string, max = 200) => String(input[key] ?? '').trim().slice(0, max);
      const list = (key: string) => (Array.isArray(input[key]) ? (input[key] as unknown[]).map(String).slice(0, 15) : []);
      const email = text('apply_email');
      const url = /^https:\/\//.test(text('apply_url', 500)) ? text('apply_url', 500) : '';
      const title = text('title');
      if (!title) return 'A job needs at least a title.';
      const deadline = /^\d{4}-\d{2}-\d{2}$/.test(text('deadline')) ? text('deadline') : '';
      const howTo = text('how_to_apply', 600);
      const all = [title, text('employer'), howTo, email, ...list('requirements')].join('\n');
      return offer(context, {
        kind: 'job',
        advert: {
          title,
          employer: text('employer'),
          location: text('location'),
          deadline,
          deadlineText: text('deadline_text'),
          salary: text('salary'),
          howToApply: { method: email ? 'email' : url ? 'portal' : 'unknown', email, url, instructions: howTo },
          requirements: list('requirements'),
          duties: [],
          documents: list('documents'),
          scamSignals: mergeSignals(scamSignals(all, email)),
          sourceUrl: '',
        },
      });
    }
    case 'track_trip': {
      const date = (key: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(input[key] ?? '')) ? String(input[key]) : '');
      const destination = String(input.destination ?? '').trim().slice(0, 60);
      if (!destination) return 'A trip needs a destination.';
      const purposes = ['visit', 'tourism', 'study', 'work', 'business', 'medical'] as const;
      const purpose = purposes.find((p) => p === input.purpose) ?? 'visit';
      return offer(context, { kind: 'trip', destination, purpose, departDate: date('depart_date'), returnDate: date('return_date') });
    }
    case 'add_reminder': {
      const date = String(input.date ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'The date must be YYYY-MM-DD.';
      const entry = input.screen === 'none' ? undefined : findEntry(String(input.screen ?? ''));
      const title = String(input.title ?? '').trim().slice(0, 80);
      if (!title) return 'A reminder needs a title.';
      return offer(context, { kind: 'reminder', title, date, route: entry ? routeWith(entry) : '' });
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
  // A JPEG (base64) sent with the latest message.
  image?: string,
): Promise<{ reply: string; actions: ChatAction[] }> {
  const client = claude();
  const context: ToolContext = { accessToken, actions: [] };

  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m, index) => {
    const isLast = index === history.length - 1;
    if (isLast && m.role === 'user' && image) {
      return {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: m.text || 'What does this show, and what should I do?' },
        ],
      };
    }
    return { role: m.role, content: m.hadImage ? `[Sent a photo] ${m.text}` : m.text };
  });

  const start = messages.length;
  let activeTools = tools;
  for (let step = 0; step < MAX_STEPS; step++) {
    const request = () => client.beta.messages.create({
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
      tools: activeTools,
      messages,
    });
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await request();
    } catch (error) {
      // If this model or account can't use web fetch, carry on without it.
      const aboutFetch = error instanceof Anthropic.BadRequestError && /web_fetch/.test(error.message);
      if (!aboutFetch || activeTools !== tools) throw error;
      console.warn('Web fetch is not available, continuing without it:', (error as Error).message);
      activeTools = tools.filter((tool) => !('name' in tool) || tool.name !== 'web_fetch');
      response = await request();
    }

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
      // Text written before a tool call ("Here's what you need:") is part of
      // the answer too.
      const reply = messages
        .slice(start)
        .flatMap((m) => (m.role === 'assistant' && Array.isArray(m.content) ? m.content : []))
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
        .map((block) => block.text.trim())
        .filter(Boolean)
        .join('\n\n');
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
