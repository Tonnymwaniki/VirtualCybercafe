// The form helper: Claude works on one task's form with the user. It sees the
// form, the user's saved details, their Locker file names and the failed
// checks, and acts through tools: fill fields, open an app tool, tick a
// requirement or a progress stage. It explains errors from eCitizen or iTax,
// including from a screenshot.

import Anthropic from '@anthropic-ai/sdk';

import type { FormTask } from '@/data/gov-tasks';
import { appTools, type AppToolId } from '@/data/guides';
import { profileFields } from '@/data/profile-fields';
import type { FieldUpdate, HelperAction, HelperRequest, HelperResponse } from '@/lib/gov-types';
import { effortOption, MODEL, modelOptions, webSearchType, WEB_CAUTION } from '@/server/model';
import { claude } from '@/server/claude';

const MAX_STEPS = 5;

const SYSTEM_PROMPT = `You are the form helper in Virtual Cybercafe, a Kenyan cybercafe app. You sit next to one form (a government service, or a job application on an employer's website) and complete it together with the user.

Rules:
- Reply in the user's language (Swahili, English or Sheng), in two to four short lines.
- Fill or correct fields with set_fields. Use only facts from: the user's saved details, what they told you, their ID, or an official source. Never make up a name, number or date; ask for it instead.
- Ask for at most two missing details at a time.
- When a check failed or the user reports an error from eCitizen, iTax or another portal (as text or a screenshot), say plainly what went wrong, fix the field with set_fields when the right value is known, and tell them exactly what to change on the site.
- Common causes: names not matching the ID exactly, extra spaces, wrong date format, a phone or ID number with a typo, an email they can't open, an expired session, or a payment still processing.
- When a document is missing, point to open_app_tool (for example the passport photo tool) or the Locker. Tick requirements with mark_ready only when the user says they have the item, or their Locker has it.
- Tick progress with set_progress only when the user says they finished that stage.
- You cannot log in to government sites, submit, or pay. Never ask for PINs or passwords; if the user shares one, tell them to change it.
- ${WEB_CAUTION}`;

function tools(task: FormTask): Anthropic.Beta.BetaToolUnion[] {
  return [
    {
      name: 'set_fields',
      description: 'Fill in or correct fields on the form. The user sees each change highlighted and can undo it.',
      input_schema: {
        type: 'object',
        properties: {
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', enum: task.fields.map((f) => f.key) },
                value: { type: 'string' },
                reason: { type: 'string', description: 'Very short: where the value came from or why it changed.' },
              },
              required: ['key', 'value', 'reason'],
              additionalProperties: false,
            },
          },
        },
        required: ['updates'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'open_app_tool',
      description: 'Show the user a button that opens one of the app’s tools.',
      input_schema: {
        type: 'object',
        properties: { tool: { type: 'string', enum: Object.keys(appTools) } },
        required: ['tool'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'mark_ready',
      description: 'Tick a requirement on the "Are you ready?" checklist.',
      input_schema: {
        type: 'object',
        properties: { requirement_id: { type: 'string', enum: task.requirements.map((r) => r.id) } },
        required: ['requirement_id'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: 'set_progress',
      description: `Mark progress up to and including a stage. Stages: ${task.stages.map((s, i) => `${i} = ${s}`).join('; ')}.`,
      input_schema: {
        type: 'object',
        properties: { stage: { type: 'integer', enum: task.stages.map((_, i) => i) } },
        required: ['stage'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: webSearchType,
      name: 'web_search',
      max_uses: 2,
      allowed_domains: task.officialDomains,
    },
  ];
}

function context(task: FormTask, request: HelperRequest) {
  const fields = task.fields
    .map((f) => `- ${f.key} (${f.label}${f.optional ? ', optional' : ''}): ${request.values[f.key]?.trim() || '(empty)'}`)
    .join('\n');
  const profile = profileFields
    .filter((f) => request.profile[f.key])
    .map((f) => `- ${f.key} (${f.label}): ${request.profile[f.key]}`)
    .join('\n');
  const issues = request.issues.map((i) => `- ${i.key}: ${i.message}`).join('\n');
  return `Task: ${task.title} (${task.agency}). Portal: ${task.portal.url}
Requirements (ids for mark_ready): ${task.requirements.map((r) => `${r.id} = ${r.label}`).join('; ')}

The form right now:
${fields}

The user's saved details:
${profile || '(none saved yet)'}

Files in their Locker: ${request.lockerFiles.length ? request.lockerFiles.join(', ') : '(none, or not signed in)'}

Checks that failed:
${issues || '(none run yet, or all passed)'}`;
}

// Without the API key: fill empty fields from the saved details.
export function sampleHelp(task: FormTask, request: HelperRequest): HelperResponse {
  const updates: FieldUpdate[] = task.fields
    .filter((f) => !request.values[f.key]?.trim() && request.profile[f.key])
    .map((f) => ({ key: f.key, value: request.profile[f.key], reason: 'From My Details' }));
  const stillEmpty = task.fields.filter(
    (f) => !f.optional && !request.values[f.key]?.trim() && !request.profile[f.key],
  );
  const reply = [
    updates.length ? `I filled ${updates.length} field${updates.length === 1 ? '' : 's'} from My Details.` : 'Nothing to fill from My Details yet.',
    stillEmpty.length ? `Still needed: ${stillEmpty.map((f) => f.label).join(', ')}.` : '',
    'The full helper switches on once the AI key is added.',
  ]
    .filter(Boolean)
    .join(' ');
  return { reply, updates, actions: [], mode: 'sample' };
}

export async function runFormHelper(task: FormTask, request: HelperRequest): Promise<HelperResponse> {
  const client = claude();
  const updates: FieldUpdate[] = [];
  const actions: HelperAction[] = [];
  const fieldKeys = new Set(task.fields.map((f) => f.key));

  const messages: Anthropic.Beta.BetaMessageParam[] = request.messages.map((m, index) => {
    const last = index === request.messages.length - 1;
    if (last && m.role === 'user' && request.image) {
      return {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: request.image } },
          { type: 'text', text: m.text || 'Here is a screenshot of the error.' },
        ],
      };
    }
    return { role: m.role, content: m.text };
  });

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      ...modelOptions,
      ...(Object.keys(effortOption).length ? { output_config: effortOption } : {}),
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: context(task, { ...request, values: { ...request.values, ...Object.fromEntries(updates.map((u) => [u.key, u.value])) } }) },
      ],
      tools: tools(task),
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return { reply: 'Sorry, I can’t help with that one.', updates, actions, mode: 'ai' };
    }
    messages.push({ role: 'assistant', content: response.content });
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
      return { reply: reply || 'Done. Check the highlighted fields.', updates, actions, mode: 'ai' };
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((toolUse) => {
      const input = (toolUse.input ?? {}) as Record<string, unknown>;
      let content = 'Done.';
      switch (toolUse.name) {
        case 'set_fields': {
          const list = Array.isArray(input.updates) ? (input.updates as FieldUpdate[]) : [];
          const valid = list.filter((u) => fieldKeys.has(u.key)).map((u) => ({ ...u, value: String(u.value).slice(0, 200) }));
          for (const update of valid) {
            const existing = updates.findIndex((u) => u.key === update.key);
            if (existing >= 0) updates.splice(existing, 1);
            updates.push(update);
          }
          content = `Updated ${valid.map((u) => u.key).join(', ') || 'nothing'}. The user can undo.`;
          break;
        }
        case 'open_app_tool': {
          const tool = appTools[input.tool as AppToolId];
          if (tool) actions.push({ type: 'open', ...tool });
          content = tool ? `A button for "${tool.label}" is shown.` : 'Unknown tool.';
          break;
        }
        case 'mark_ready':
          actions.push({ type: 'ready', requirementId: String(input.requirement_id) });
          content = 'Ticked on the checklist.';
          break;
        case 'set_progress':
          actions.push({ type: 'stage', stage: Number(input.stage) });
          content = 'Progress updated.';
          break;
        default:
          content = `Unknown tool ${toolUse.name}.`;
      }
      return { type: 'tool_result', tool_use_id: toolUse.id, content };
    });
    messages.push({ role: 'user', content: results });
  }

  return { reply: 'I’ve made the changes I could. What else do you see?', updates, actions, mode: 'ai' };
}
